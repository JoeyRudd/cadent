import { connection } from "next/server";
import { Suspense } from "react";

import { RunCard } from "@/components/RunCard";
import { dayLabel, km, runTypeLabel, weekday } from "@/lib/format";
import { localDate, nextRun, plan, sessionsOn, type Lift, type Run } from "@/lib/plan";

export default function Home() {
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <Suspense>
        <Today />
      </Suspense>
    </main>
  );
}

// Reads the clock, so it renders per request instead of at build time.
async function Today() {
  await connection();
  const day = localDate(new Date());
  const sessions = sessionsOn(plan, day);
  const lift = sessions.find((s): s is Lift => s.kind === "lift");

  return (
    <>
      <p className="text-muted">Good morning</p>
      <h1 className="mt-1 text-2xl font-semibold">{dayLabel(day)}</h1>

      <div className="mt-6 space-y-4">
        <Hero day={day} run={sessions.find((s): s is Run => s.kind === "run")} />
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

function Hero({ day, run }: { day: string; run: Run | undefined }) {
  const start = plan.weeks[0].start;
  if (day < start) return <Message>Plan starts {dayLabel(start)}.</Message>;
  if (day > plan.race.date) return <Message>Plan complete. Well run.</Message>;
  if (run) return <RunCard run={run} zones={plan.zones} />;

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
