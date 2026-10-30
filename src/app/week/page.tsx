import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { WeekDayRow } from "@/components/WeekDayRow";
import { WeekPicker } from "@/components/WeekPicker";
import { ICON_BUTTON } from "@/components/iconButton";
import { activitiesBetween } from "@/lib/activities";
import { dayLabel, km } from "@/lib/format";
import { currentPlan } from "@/lib/moves";
import { localDate } from "@/lib/plan";
import { addDays, currentWeek, pickWeek, weeksOf, type Week } from "@/lib/week";

export default function WeekPage({ searchParams }: PageProps<"/week">) {
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <Suspense>
        <PlanWeek searchParams={searchParams} />
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
// `?w=5` opens week 5; without it, this week.
async function PlanWeek({ searchParams }: { searchParams: PageProps<"/week">["searchParams"] }) {
  const { w } = await searchParams;
  await connection();
  const today = localDate(new Date());
  const plan = currentPlan();
  const first = plan.weeks[0].start;
  const last = addDays(plan.weeks[plan.weeks.length - 1].start, 6);
  const weeks = weeksOf(plan, activitiesBetween(first, last), today);
  const week = pickWeek(weeks, w, today);
  const at = weeks.indexOf(week);

  return (
    <>
      <header className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-muted">
            Week {week.index} of {weeks[weeks.length - 1].index}
            {week.cutback ? ", cutback" : ""}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            {shortDate(week.start)} – {shortDate(week.end)}
          </h1>
        </div>
        <Pager week={weeks[at - 1]} label="Previous week" path="M15 6l-6 6 6 6" />
        <Pager week={weeks[at + 1]} label="Next week" path="M9 6l6 6-6 6" />
      </header>

      <div className="mt-4">
        <WeekPicker
          // Only the totals, not every day and run, go to the client.
          weeks={weeks.map(({ index, planned_m, actual_m }) => ({ index, planned_m, actual_m }))}
          selected={week.index}
          current={currentWeek(weeks, today)?.index}
        />
      </div>

      <Summary week={week} today={today} />

      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-card bg-surface">
        {week.days.map((day) => (
          <WeekDayRow key={day.date} day={day} isToday={day.date === today} />
        ))}
      </ul>
    </>
  );
}

/** A round chevron link to the week before or after; dimmed at either end of the plan. */
function Pager({ week, label, path }: { week: Week | undefined; label: string; path: string }) {
  const icon = (
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
      <path d={path} />
    </svg>
  );
  return week ? (
    <Link href={`/week?w=${week.index}`} aria-label={label} className={ICON_BUTTON}>
      {icon}
    </Link>
  ) : (
    <span aria-label={label} aria-disabled="true" className={`${ICON_BUTTON} opacity-40`}>
      {icon}
    </span>
  );
}

/** The week's main number: run against planned so far, or just what's planned before it starts. */
function Summary({ week, today }: { week: Week; today: string }) {
  const ahead = today < week.start;
  const toGo = week.planned_m - week.actual_m;
  const runs = week.days.reduce((sum, d) => sum + d.runs.length, 0);
  const note = ahead
    ? `${runs} ${runs === 1 ? "run" : "runs"}, starts ${dayLabel(week.start)}`
    : toGo <= 0
      ? "Week's distance done"
      : week.end < today
        ? `${km(toGo)} km short, that's fine`
        : `${km(toGo)} km to go`;

  return (
    <section className="mt-4 rounded-card bg-surface p-6">
      <p className="text-6xl font-semibold">
        {ahead ? km(week.planned_m) : km(week.actual_m)}{" "}
        <span className="text-2xl font-medium text-muted">{ahead ? "km planned" : `/ ${km(week.planned_m)} km`}</span>
      </p>
      <p className="mt-2 text-muted">{note}</p>
    </section>
  );
}
