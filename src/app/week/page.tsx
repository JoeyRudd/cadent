import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { moveRun } from "@/app/run/[date]/actions";
import { ICON_BUTTON } from "@/components/iconButton";
import { WeekBoard } from "@/components/WeekBoard";
import { activitiesBetween } from "@/lib/activities";
import { km } from "@/lib/format";
import { currentPlan, moveTargets } from "@/lib/moves";
import { localDate, type Plan } from "@/lib/plan";
import { addDays, dayParam, mondayOf, neighbourWeeks, planTotals, weekBounds, weekOf, type Week } from "@/lib/week";

export default function WeekPage({ searchParams }: PageProps<"/week">) {
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <Suspense>
        <ShownWeek searchParams={searchParams} />
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

const weekHref = (start: string) => `/week?start=${start}`;

// Reads the clock and the database, so it renders per request instead of at build time.
// `?start=` picks the week (any day in it works); without it, this week.
async function ShownWeek({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { start: param } = await searchParams;
  await connection();
  const today = localDate(new Date());
  const plan = currentPlan();
  const day = dayParam(param) ?? today;
  const bounds = weekBounds(plan, day);
  const week = bounds && weekOf(plan, activitiesBetween(bounds.start, bounds.end), today, day);
  const start = bounds?.start ?? mondayOf(day);
  const thisWeek = weekBounds(plan, today)?.start ?? mondayOf(today);
  const { prev, next } = neighbourWeeks(plan, start);

  const header = (
    <>
      <header className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-muted">
            {week ? `Week ${week.index}` : "No plan"}
            {/* A pill, so it reads as a way back rather than a label for the week shown. */}
            {start !== thisWeek && (
              <Link
                href="/week"
                className="-my-2.5 rounded-full bg-accent-soft px-3 py-0.5 text-sm font-medium text-accent-ink outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
              >
                This week
              </Link>
            )}
          </p>
          <h1 className="text-2xl font-semibold">
            {shortDate(start)} to {shortDate(addDays(start, 6))}
          </h1>
        </div>
        <PageLink start={prev} label="Previous week" path="M15 6l-6 6 6 6" />
        <PageLink start={next} label="Next week" path="M9 6l6 6-6 6" />
      </header>

      <PlanWeeks plan={plan} shown={start} thisWeek={thisWeek} />
      {week ? (
        <Summary week={week} today={today} />
      ) : (
        <p className="mt-6 rounded-card bg-surface p-6 text-muted">
          No plan this week. The plan runs {shortDate(plan.weeks[0].start)} to {shortDate(plan.race.date)}.
        </p>
      )}
    </>
  );

  if (!week) return header;
  return (
    <WeekBoard
      key={week.start}
      days={week.days}
      today={today}
      targets={movableRuns(plan, week)}
      move={moveRun}
      prev={prev && weekHref(prev)}
      next={next && weekHref(next)}
    >
      {header}
    </WeekBoard>
  );
}

/** For each day whose run can move, the days it can move to. A recorded run stays put unless it was moved there, as on run detail. */
function movableRuns(moved: Plan, week: Week): Record<string, string[]> {
  const movable = week.days.filter((d) => d.runs.length > 0 && (d.actual_m === 0 || d.runs.some((r) => r.planned_date)));
  return Object.fromEntries(movable.map((d) => [d.date, moveTargets(moved, d.date)]));
}

/** The week's one number: distance run against the plan, or what's planned for a week still to come. */
function Summary({ week, today }: { week: Week; today: string }) {
  const toGo = week.planned_m - week.actual_m;
  const future = week.start > today;
  let line: string;
  if (future) line = `${week.days.reduce((n, d) => n + d.runs.length, 0)} runs planned`;
  else if (toGo <= 0) line = "Week's distance done";
  else if (week.end < today) line = `${km(toGo)} km under plan, that's fine`;
  else line = `${km(toGo)} km to go`;

  return (
    <section className="mt-4 rounded-card bg-surface p-6">
      <p className="text-6xl font-semibold">
        {future ? (
          <>
            {km(week.planned_m)} <span className="text-2xl font-medium text-muted">km planned</span>
          </>
        ) : (
          <>
            {km(week.actual_m)} <span className="text-2xl font-medium text-muted">/ {km(week.planned_m)} km</span>
          </>
        )}
      </p>
      <p className="mt-2 text-muted">{line}</p>
    </section>
  );
}

/** Previous or next week, or an empty space of the same size at the ends of the plan. */
function PageLink({ start, label, path }: { start?: string; label: string; path: string }) {
  if (!start) return <span className="size-11" />;
  return (
    <Link href={weekHref(start)} aria-label={label} className={ICON_BUTTON}>
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
    </Link>
  );
}

// Planned km for every week of the plan as bars: the shown week in the accent, a dot under this
// week. Each bar jumps to its week; the arrows above do the same one step at a time.
function PlanWeeks({ plan, shown, thisWeek }: { plan: Plan; shown: string; thisWeek: string }) {
  const weeks = planTotals(plan);
  const most = Math.max(...weeks.map((w) => w.planned_m));

  return (
    <nav aria-label="Weeks of the plan" className="mt-4">
      <ol className="flex h-10">
        {weeks.map((w) => {
          const isShown = w.start === shown;
          return (
            <li key={w.start} className="flex-1">
              <Link
                href={weekHref(w.start)}
                aria-label={`Week ${w.index}, ${km(w.planned_m)} km${w.start === thisWeek ? ", this week" : ""}`}
                aria-current={isShown ? "page" : undefined}
                className="flex h-full flex-col justify-end gap-1 px-0.5"
              >
                {/* The bar height is data, so it can't be a class. */}
                <span
                  className={`w-full rounded-sm ${isShown ? "bg-accent" : "bg-muted"}`}
                  style={{ height: `${most > 0 ? Math.max(8, (w.planned_m / most) * 100) : 8}%` }}
                />
                <span className={`mx-auto size-1.5 rounded-full ${w.start === thisWeek ? "bg-ink" : ""}`} />
              </Link>
            </li>
          );
        })}
      </ol>
      <p aria-hidden="true" className="mt-1 flex justify-between text-xs text-muted">
        <span>{shortDate(plan.weeks[0].start)}</span>
        <span>Race {shortDate(plan.race.date)}</span>
      </p>
    </nav>
  );
}
