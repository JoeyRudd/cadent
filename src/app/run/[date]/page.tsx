import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { CheckIn } from "@/components/CheckIn";
import { MoveRun } from "@/components/MoveRun";
import { Laps, Splits } from "@/components/Splits";
import { LineChart } from "@/components/charts/LineChart";
import { ZoneTime } from "@/components/charts/ZoneTime";
import { activitiesBetween, detailsFor, type Activity, type Details } from "@/lib/activities";
import { clock, km, pace, paceTarget, runTypeLabel, shortDayLabel, zoneLabel } from "@/lib/format";
import { checkInOn } from "@/lib/checkins";
import { currentPlan, moveTargets, moveWarnings } from "@/lib/moves";
import { isDay, localDate, type Plan, type Run } from "@/lib/plan";
import {
  joinDetails,
  kmSplits,
  lapKinds,
  paceRange,
  paceSeries,
  runDetail,
  runStats,
  zoneTime,
  type Recorded,
  type RunDetail,
} from "@/lib/run";
import { isRun, weekOf } from "@/lib/week";

import { moveRunFor, saveCheckInFor } from "./actions";

export default function RunPage({ params }: PageProps<"/run/[date]">) {
  return (
    <main className="mx-auto max-w-md px-5 py-7">
      <Suspense>
        <Detail params={params} />
      </Suspense>
    </main>
  );
}

type Tone = "on" | "off" | "plain";

const BANNERS: Record<Tone, { box: string; title: string }> = {
  on: { box: "bg-on-plan-soft", title: "text-on-plan" },
  off: { box: "bg-off-plan-soft", title: "text-off-plan" },
  plain: { box: "border border-line bg-surface", title: "text-ink" },
};

// Reads the clock and the database, so it renders per request instead of at build time.
async function Detail({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isDay(date)) notFound();
  await connection();
  const today = localDate(new Date());
  const moved = currentPlan();
  const activities = dayActivities(date);
  const detail = runDetail(moved, activities, date, today);
  const { run, planned_m, recorded, status, zone, hr } = detail;
  // From the distances as shown, so "5.2 km" against "5.0" always reads "+0.2".
  const gap = run && recorded ? Number(km(recorded.distance_m)) - Number(km(planned_m)) : 0;
  const banner = verdict(detail, Math.abs(gap).toFixed(1));

  return (
    <>
      <header className="flex items-center gap-3">
        <Link
          href="/"
          aria-label="Back"
          className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
        >
          <svg
            aria-hidden="true"
            className="size-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold">{run ? runTypeLabel(run.type) : "Run"}</h1>
          <p className="text-sm text-muted">{shortDayLabel(date)}</p>
        </div>
      </header>

      <div className="mt-4 space-y-3">
        <section className={`flex flex-col gap-1 rounded-card px-4 py-3.5 ${BANNERS[banner.tone].box}`}>
          <p className={`text-lg font-bold ${BANNERS[banner.tone].title}`}>{banner.title}</p>
          <p className="text-sm leading-snug text-ink">{banner.body}</p>
        </section>

        {(run || recorded) && (
          <div className="grid grid-cols-2 gap-2.5">
            <Tile
              label="Distance"
              value={recorded && km(recorded.distance_m)}
              unit="km"
              plan={run && `Plan ${km(planned_m)} km`}
              pill={
                (status === "done" || status === "short" || status === "over") && {
                  label: `${gap < 0 ? "−" : "+"}${Math.abs(gap).toFixed(1)} km`,
                  onPlan: status === "done",
                }
              }
            />
            <Tile
              label="Pace"
              value={recorded?.pace_s_per_km != null ? pace(recorded.pace_s_per_km) : undefined}
              unit="/km"
              plan={run?.pace_s_per_km !== undefined ? `Plan ${paceTarget(run.pace_s_per_km)}` : undefined}
              pill={
                detail.pace && {
                  label: { fast: "Faster", on: "On target", slow: "Slower" }[detail.pace],
                  onPlan: detail.pace === "on",
                }
              }
            />
            <Tile
              label="Avg heart rate"
              value={recorded?.avg_hr != null ? String(recorded.avg_hr) : undefined}
              unit="bpm"
              plan={run?.zone && zone && `Plan ${zoneLabel(run.zone)} · ${zone[0]}–${zone[1]}`}
              pill={hr && { label: { below: "Below zone", in: "In zone", above: "Above zone" }[hr], onPlan: hr === "in" }}
            />
            <Tile label="Time" value={recorded && clock(recorded.duration_s)} />
          </div>
        )}

        {recorded && <RunData details={dayDetails(activities)} plan={moved} run={run} recorded={recorded} />}

        {/* A recorded run stays put, unless it was moved there: then it can still go back. */}
        {run && (!recorded || run.planned_date) && (
          <MoveRun
            action={moveRunFor.bind(null, date)}
            days={weekDays(moved, date)}
            current={date}
            plannedOn={run.planned_date}
            warnings={moveWarnings(moved, date)}
          />
        )}
        {recorded && <CheckIn key={date} action={saveCheckInFor.bind(null, date)} saved={savedCheckIn(date)} />}
      </div>
    </>
  );
}

/** That day's runs. A database error shows the plan alone rather than failing the page. */
function dayActivities(date: string) {
  try {
    return activitiesBetween(date, date);
  } catch (error) {
    console.error("Couldn't read activities", error);
    return [];
  }
}

/** The day's runs' laps and samples as one run. A database error shows the run without them. */
function dayDetails(activities: Activity[]): Details | undefined {
  try {
    const runs = activities.filter(isRun);
    const found = detailsFor(runs.map((a) => a.id));
    const details = runs.map((a) => found.get(a.id)).filter((d) => d !== undefined);
    return details.length > 0 ? joinDetails(details) : undefined;
  } catch (error) {
    console.error("Couldn't read run details", error);
    return undefined;
  }
}

/** Lowest and highest of `values` with `pad` either side, widened to take in `band`. */
function domainOf(values: number[], pad: number, band?: [number, number]): [number, number] {
  const sorted = [...values].sort((a, b) => a - b);
  // The 5th to 95th percentile: a GPS spike or a sprint for the light shouldn't squash the rest.
  const [lo, hi] = [sorted[Math.floor(sorted.length * 0.05)], sorted[Math.ceil(sorted.length * 0.95) - 1]];
  return [Math.min(lo, band?.[0] ?? lo) - pad, Math.max(hi, band?.[1] ?? hi) + pad];
}

// Everything the watch recorded beyond the tiles, as one card: a quiet stats line, pace and heart rate
// along the run, zones, then a workout's laps (its story) ahead of the kilometre splits.
function RunData({
  details,
  plan,
  run,
  recorded,
}: {
  details?: Details;
  plan: Plan;
  run?: Run;
  recorded: Recorded;
}) {
  // A treadmill run without distance has nothing to draw along.
  if (!details || details.points.length < 2 || details.points.at(-1)!.distance_m <= 0) {
    return (
      <p className="rounded-card border border-line bg-surface p-4 text-sm text-muted">
        Splits and charts show up here once Garmin sends this run&apos;s details.
      </p>
    );
  }

  const stats = runStats(details);
  const splits = kmSplits(details.points);
  const full = splits.filter((s) => s.distance_m >= 1000);
  const fastest = full.reduce((a, b) => (b.pace_s_per_km < a.pace_s_per_km ? b : a), full[0]);
  const paces = paceSeries(details.points);
  const paceValues = paces.map(([, v]) => v).filter((v) => v !== null);
  const hrs = details.points.map((p): [number, number | null] => [p.distance_m, p.hr]);
  const hrValues = hrs.map(([, v]) => v).filter((v) => v !== null);
  const hrBand = run?.zone ? plan.zones[run.zone] : undefined;
  const profile = details.points.flatMap((p): [number, number][] => (p.elev_m === null ? [] : [[p.distance_m, p.elev_m]]));

  // The run's own pace target if it has one; for a workout, its reps' pace (shaded on the chart and the laps).
  const runBand = run?.pace_s_per_km !== undefined ? paceRange(run.pace_s_per_km) : undefined;
  const reps = run?.blocks?.find((b) => b.pace_s_per_km);
  const repBand = reps?.pace_s_per_km && paceRange(reps.pace_s_per_km);
  const chartBand = runBand ?? repBand;
  const paceNote = runBand
    ? `Shaded: plan ${paceTarget(run!.pace_s_per_km!)}. Elevation underneath.`
    : repBand
      ? `Shaded: ${reps!.label} reps ${paceTarget(reps!.pace_s_per_km!)}. Elevation underneath.`
      : "No pace target in the plan for this run. Elevation underneath.";
  const kinds = lapKinds(details.laps);

  return (
    <section aria-labelledby="watch" className="rounded-card border border-line bg-surface p-4">
      <h2 id="watch" className="text-lg font-bold">
        From your watch
      </h2>
      <p className="mt-1 text-sm text-muted">
        {[
          stats.max_hr !== undefined && `Max HR ${stats.max_hr} bpm`,
          stats.climb_m !== undefined && `Climb ${stats.climb_m} m`,
          stats.cadence_spm !== undefined && `Cadence ${stats.cadence_spm} spm`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <div className="mt-2 divide-y divide-line">
        {paceValues.length > 1 && recorded.pace_s_per_km !== null && (
          <Part title="Pace" note={paceNote}>
            <LineChart
              kind="pace"
              label={`Pace along ${km(details.points.at(-1)!.distance_m)} km${
                fastest ? `, fastest kilometre ${fastest.km} at ${pace(fastest.pace_s_per_km)} per km` : ""
              }.`}
              average={recorded.pace_s_per_km}
              series={paces}
              domain={domainOf(paceValues, 15, chartBand)}
              band={chartBand}
              profile={profile}
            />
          </Part>
        )}

        {hrValues.length > 1 && recorded.avg_hr !== null && (
          <Part
            title="Heart rate"
            note={hrBand && run?.zone ? `Shaded: ${zoneLabel(run.zone)} ${hrBand[0]}–${hrBand[1]}` : undefined}
          >
            <LineChart
              kind="hr"
              label={`Heart rate from ${Math.min(...hrValues)} to ${Math.max(...hrValues)} bpm.`}
              average={recorded.avg_hr}
              series={hrs}
              domain={domainOf(hrValues, 5, hrBand)}
              band={hrBand}
            />
            <div className="mt-4">
              <ZoneTime bands={zoneTime(details.points, plan.zones)} planned={run?.zone} />
            </div>
          </Part>
        )}

        {details.laps.length > 1 && (
          <Part title="Laps" note={kinds ? "Named from their pace" : "As your watch recorded them"}>
            <Laps laps={details.laps} kinds={kinds} target={repBand} />
          </Part>
        )}

        {splits.length > 0 && (
          <Part
            title="Splits"
            note={`${runBand ? "Longer bar is faster, green on target" : "Longer bar is faster"}${
              fastest ? `. Fastest: km ${fastest.km}, ${pace(fastest.pace_s_per_km)}` : ""
            }`}
          >
            <Splits splits={splits} target={runBand} />
          </Part>
        )}
      </div>
    </section>
  );
}

function Part({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="py-4 last:pb-0">
      <div className="mb-3">
        <h3 className="font-semibold">{title}</h3>
        {note && <p className="text-xs text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** Monday to Sunday of the run's week; a day is free when the run on `date` could move there. */
function weekDays(moved: Plan, date: string) {
  const free = moveTargets(moved, date);
  return (weekOf(moved, [], date)?.days ?? []).map((day) => ({ date: day.date, free: free.includes(day.date) }));
}

/** The check-in already saved for the day. A database error shows an empty form rather than failing the page. */
function savedCheckIn(date: string) {
  try {
    return checkInOn(date);
  } catch (error) {
    console.error("Couldn't read check-in", error);
    return undefined;
  }
}

/** The headline: plainly on plan, or gently how it differed. `gap` is the distance off plan, as shown. */
function verdict({ run, planned_m, recorded, status, hr }: RunDetail, gap: string): { tone: Tone; title: string; body: string } {
  const zone = run?.zone ? zoneLabel(run.zone) : "";
  const word = hr === "above" ? "above" : hr === "below" ? "under" : undefined;
  const hrNote = word ? ` Average heart rate was ${word} ${zone}.` : "";

  switch (status) {
    case "rest":
      return { tone: "plain", title: "Rest day", body: "Nothing planned. Enjoy it." };
    case "upcoming":
      return recorded
        ? { tone: "plain", title: "Under way", body: `${km(recorded.distance_m)} of ${km(planned_m)} km so far.` }
        : { tone: "plain", title: "Planned", body: "The details show up here once your run syncs." };
    case "missed":
      return { tone: "off", title: "Not recorded", body: "No run synced for this day. Skipped is fine." };
    case "extra":
      return { tone: "off", title: "Bonus run", body: "Not in the plan. Keep the next one easy." };
    case "short":
      return { tone: "off", title: "A bit short", body: `${gap} km short, that's fine.${hrNote}` };
    case "over":
      return { tone: "off", title: "A bit long", body: `${gap} km over, keep the next one easy.${hrNote}` };
  }
  if (hr === "above") return { tone: "off", title: "Heart rate ran high", body: `On distance.${hrNote} Ease the pace next time.` };
  if (hr === "below") return { tone: "off", title: "Easier than planned", body: `On distance.${hrNote}` };
  const body = hr === "in" ? `On distance, and your average heart rate was in ${zone}.` : "On distance.";
  return { tone: "on", title: "Right on plan", body };
}

/** One plan-vs-actual figure; a dash when Garmin has nothing for it. */
function Tile({
  label,
  value,
  unit,
  plan,
  pill,
}: {
  label: string;
  value?: string;
  unit?: string;
  plan?: string;
  pill?: { label: string; onPlan: boolean } | false;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-line bg-surface p-3.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-bold">
        {value ?? "–"}
        {unit && value !== undefined && <span className="text-sm font-medium text-muted"> {unit}</span>}
      </p>
      {plan && <p className="text-xs text-muted">{plan}</p>}
      {pill && (
        <p
          className={`self-start rounded-full px-2 py-0.5 text-xs font-semibold ${
            pill.onPlan ? "bg-on-plan-soft text-on-plan" : "bg-off-plan-soft text-off-plan"
          }`}
        >
          {pill.label}
        </p>
      )}
    </div>
  );
}
