import { connection } from "next/server";
import { Suspense } from "react";

import { WeekDayRow } from "@/components/WeekDayRow";
import { activitiesBetween } from "@/lib/activities";
import { km } from "@/lib/format";
import { localDate, plan } from "@/lib/plan";
import { weekBounds, weekOf } from "@/lib/week";

export default function WeekPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <Suspense>
        <ThisWeek />
      </Suspense>
    </main>
  );
}

/** "2026-10-26" → "Oct 26". Plan dates parse as UTC midnight. */
function shortDate(day: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(day),
  );
}

// Reads the clock and the database, so it renders per request instead of at build time.
async function ThisWeek() {
  await connection();
  const today = localDate(new Date());
  const bounds = weekBounds(plan, today);
  const week = bounds && weekOf(plan, activitiesBetween(bounds.start, bounds.end), today);

  if (!week) {
    return <p className="rounded-card bg-surface p-6 text-muted">No plan this week.</p>;
  }

  const toGo = week.planned_m - week.actual_m;
  return (
    <>
      <p className="text-muted">Week {week.index}</p>
      <h1 className="mt-1 text-2xl font-semibold">
        {shortDate(week.start)} – {shortDate(week.end)}
      </h1>

      <section className="mt-6 rounded-card bg-surface p-6">
        <p className="text-6xl font-semibold">
          {km(week.actual_m)}{" "}
          <span className="text-2xl font-medium text-muted">/ {km(week.planned_m)} km</span>
        </p>
        <p className="mt-2 text-muted">{toGo > 0 ? `${km(toGo)} km to go` : "Week's distance done"}</p>
      </section>

      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-card bg-surface">
        {week.days.map((day) => (
          <WeekDayRow key={day.date} day={day} isToday={day.date === today} />
        ))}
      </ul>
    </>
  );
}
