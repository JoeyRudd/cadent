import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { Readiness } from "@/components/Readiness";
import { RunCard } from "@/components/RunCard";
import { SyncButton } from "@/components/SyncButton";
import { WeekStrip } from "@/components/WeekStrip";
import { ICON_BUTTON } from "@/components/iconButton";
import { activitiesBetween } from "@/lib/activities";
import { dayLabel, km, runTypeLabel, weekday } from "@/lib/format";
import { currentPlan } from "@/lib/moves";
import { localDate, nextRun, sessionsOn, type Lift, type Plan, type Run } from "@/lib/plan";
import { addDays, weekBounds, weekOf } from "@/lib/week";
import { readinessOn, wellnessBetween } from "@/lib/wellness";

export default function Home() {
  return (
    <main className="mx-auto max-w-md px-5 py-7">
      <Suspense>
        <Today />
      </Suspense>
    </main>
  );
}

// Reads the clock and the database, so it renders per request instead of at build time.
async function Today() {
  await connection();
  const day = localDate(new Date());
  const plan = currentPlan();
  const sessions = sessionsOn(plan, day);
  const lift = sessions.find((s): s is Lift => s.kind === "lift");
  const week = thisWeek(plan, day);
  const readiness = lastNight(day);

  return (
    <>
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">{dayLabel(day)}</p>
          <h1 className="mt-0.5 text-2xl font-bold">Good morning, Joey</h1>
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

      <div className="mt-4 space-y-4">
        <Hero plan={plan} day={day} run={sessions.find((s): s is Run => s.kind === "run")} week={week?.index} />
        {readiness && <Readiness readiness={readiness} />}
        {week && <WeekStrip week={week} today={day} />}
        {lift && (
          <section className="rounded-card border border-line bg-surface p-4">
            <p className="font-medium">{lift.name}</p>
            <p className="text-sm text-muted">{lift.after_run ? "Strength, after your run" : "Strength"}</p>
          </section>
        )}
      </div>
    </>
  );
}

/** This week against Garmin. A database error hides the week card rather than today's run. */
function thisWeek(plan: Plan, day: string) {
  const bounds = weekBounds(plan, day);
  if (!bounds) return undefined;
  try {
    return weekOf(plan, activitiesBetween(bounds.start, bounds.end), day);
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

function Hero({ plan, day, run, week }: { plan: Plan; day: string; run: Run | undefined; week?: number }) {
  const start = plan.weeks[0].start;
  if (day < start) return <Message>Plan starts {dayLabel(start)}.</Message>;
  if (day > plan.race.date) return <Message>Plan complete. Well run.</Message>;
  if (run) return <RunCard run={run} zones={plan.zones} week={week} />;

  const next = nextRun(plan, day);
  return (
    <section className="rounded-card bg-surface p-6">
      <p className="text-4xl font-semibold">Rest day</p>
      {next && (
        <p className="mt-2 text-muted">
          Next up: {runTypeLabel(next.type)} {km(next.distance_m)} km, {weekday(next.date)}
        </p>
      )}
    </section>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <p className="rounded-card bg-surface p-6 text-muted">{children}</p>;
}
