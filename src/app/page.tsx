import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { Chevron } from "@/components/Chevron";
import { Readiness } from "@/components/Readiness";
import { RunCard } from "@/components/RunCard";
import { RunRow } from "@/components/RunRow";
import { SyncButton } from "@/components/SyncButton";
import { WeekStrip } from "@/components/WeekStrip";
import { ICON_BUTTON, ROW_LINK } from "@/components/iconButton";
import { activitiesBetween, type Activity } from "@/lib/activities";
import { dayLabel, km, runTypeLabel, shortDayLabel, timeAndPace, weekday } from "@/lib/format";
import { currentPlan } from "@/lib/moves";
import { localDate, localHour, nextRun, sessionsOn, type Lift, type Plan, type Run } from "@/lib/plan";
import { recentRuns } from "@/lib/run";
import { addDays, weekOf, type WeekDay } from "@/lib/week";
import { readinessOn, wellnessBetween } from "@/lib/wellness";

export default function Home() {
  return (
    <main className="mx-auto max-w-md px-5 py-7 md:max-w-3xl">
      <Suspense fallback={<TodayPlaceholder />}>
        <Today />
      </Suspense>
    </main>
  );
}

/** Empty blocks the size of the cards, so the page doesn't jump when Today streams in. */
function TodayPlaceholder() {
  return (
    <div aria-hidden="true">
      <div className="h-14" />
      <div className="mt-4 space-y-4 md:grid md:grid-cols-2 md:items-start md:gap-4 md:space-y-0">
        <div className="space-y-4">
          <div className="h-80 rounded-card bg-surface" />
          <div className="h-36 rounded-card bg-surface" />
        </div>
        <div className="space-y-4">
          <div className="h-80 rounded-card bg-surface" />
          <div className="h-64 rounded-card bg-surface" />
        </div>
      </div>
    </div>
  );
}

/** "Good morning" until noon, "Good afternoon" until 6 pm, then "Good evening". */
function greeting(now: Date): string {
  const hour = localHour(now);
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

// Reads the clock and the database, so it renders per request instead of at build time.
async function Today() {
  await connection();
  const now = new Date();
  const day = localDate(now);
  const plan = currentPlan();
  const sessions = sessionsOn(plan, day);
  const lift = sessions.find((s): s is Lift => s.kind === "lift");
  const activities = recentActivities(day);
  const week = activities && weekOf(plan, activities, day);
  const lastWeek = week && activities && weekOf(plan, activities, day, addDays(week.start, -7));
  const today = week?.days.find((d) => d.date === day);
  const readiness = lastNight(day);

  return (
    <>
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">{shortDayLabel(day)}</p>
          <h1 className="mt-0.5 text-xl font-bold">{greeting(now)}, Joey</h1>
        </div>
        <div className="flex gap-2">
          <SyncButton />
          <Link href="/settings" aria-label="Settings" className={ICON_BUTTON}>
            <svg
              aria-hidden="true"
              className="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="10" cy="17" r="2" />
            </svg>
          </Link>
        </div>
      </header>

      <div className="mt-4 space-y-4 md:grid md:grid-cols-2 md:items-start md:gap-4 md:space-y-0">
        <div className="space-y-4">
          <Hero
            plan={plan}
            day={day}
            run={sessions.find((s): s is Run => s.kind === "run")}
            lift={lift}
            week={week?.index}
            done={today && today.actual_m > 0 ? today : undefined}
          />
          {readiness && <Readiness readiness={readiness} />}
        </div>
        <div className="space-y-4">
          {week && <WeekStrip week={week} today={day} previous={lastWeek} />}
          {activities && <Recent plan={plan} activities={activities} today={day} />}
        </div>
      </div>
    </>
  );
}

/** The last four weeks of runs, enough for this week, last week and the recent list. A database error hides those cards rather than today's run. */
function recentActivities(day: string): Activity[] | undefined {
  try {
    return activitiesBetween(addDays(day, -27), day);
  } catch (error) {
    console.error("Couldn't read activities", error);
    return undefined;
  }
}

/** Last night's wellness against the week before. A database error hides the card. */
function lastNight(day: string) {
  try {
    return readinessOn(wellnessBetween(addDays(day, -7), day), day);
  } catch (error) {
    console.error("Couldn't read wellness", error);
    return undefined;
  }
}

function Hero({
  plan,
  day,
  run,
  lift,
  week,
  done,
}: {
  plan: Plan;
  day: string;
  run: Run | undefined;
  lift: Lift | undefined;
  week?: number;
  done?: WeekDay;
}) {
  const start = plan.weeks[0].start;
  if (day < start) return <Message>Plan starts {dayLabel(start)}.</Message>;
  if (day > plan.race.date) return <Message>Plan complete. Well run.</Message>;
  if (run) return <RunCard run={run} zones={plan.zones} week={week} lift={lift} done={done} />;

  const next = nextRun(plan, day);
  return (
    <section className="rounded-card bg-surface p-5">
      <p className="text-2xl font-semibold">{done ? "Bonus run" : "Rest day"}</p>
      {done && (
        <p className="mt-1 text-muted">
          {km(done.actual_m)} km, {timeAndPace(done.duration_s, done.pace_s_per_km)}
        </p>
      )}
      {lift && (
        <p className="mt-1 text-muted">{lift.after_run ? `Strength, after your run: ${lift.name}` : `Strength: ${lift.name}`}</p>
      )}
      {next && (
        <Link
          href={`/run/${next.date}`}
          className={`-mx-2 mt-3 flex min-h-11 items-center gap-2 rounded-button px-2 ${ROW_LINK}`}
        >
          <span className="flex-1 text-muted">
            Next up: {runTypeLabel(next.type)} {km(next.distance_m)} km, {weekday(next.date)}
          </span>
          <Chevron />
        </Link>
      )}
    </section>
  );
}

/** The latest runs, each opening its day. A day before the plan has nothing to compare with, so no status. */
function Recent({ plan, activities, today }: { plan: Plan; activities: Activity[]; today: string }) {
  const runs = recentRuns(plan, activities, today);
  return (
    <section>
      <h2 className="mb-2 px-1 font-semibold">Recent runs</h2>
      {runs.length === 0 ? (
        <p className="rounded-card bg-surface p-5 text-muted">No runs in the last four weeks. Use the sync button above to pull them in.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {runs.map((run) => (
            <li key={run.date}>
              <RunRow run={run} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <p className="rounded-card bg-surface p-6 text-muted">{children}</p>;
}
