import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { CheckIn } from "@/components/CheckIn";
import { activitiesBetween } from "@/lib/activities";
import { clock, km, pace, paceTarget, runTypeLabel, shortDayLabel, zoneLabel } from "@/lib/format";
import { checkInOn } from "@/lib/checkins";
import { isDay, localDate, plan } from "@/lib/plan";
import { runDetail, type RunDetail } from "@/lib/run";

import { saveCheckInFor } from "./actions";

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
  const detail = runDetail(plan, dayActivities(date), date, today);
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
