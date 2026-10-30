import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { moveRun } from "@/app/run/[date]/actions";
import { AskClaude } from "@/components/AskClaude";
import { ICON_BUTTON } from "@/components/iconButton";
import { Stat } from "@/components/Stat";
import { WeekBoard } from "@/components/WeekBoard";
import { WeekPicker } from "@/components/WeekPicker";
import { activitiesBetween } from "@/lib/activities";
import { hoursMinutes, km, pace, shortDate, weekProgress, weeksAway } from "@/lib/format";
import { currentPlan, moveTargets } from "@/lib/moves";
import { connectorUrls } from "@/lib/oauth";
import { localDate, type Plan } from "@/lib/plan";
import { addDays, dayParam, mondayOf, neighbourWeeks, planTotals, weekBounds, weekOf, type Week } from "@/lib/week";

export default function WeekPage({ searchParams }: PageProps<"/week">) {
  return (
    <main className="mx-auto max-w-md px-4 py-8 md:max-w-xl">
      <Suspense fallback={<WeekPlaceholder />}>
        <ShownWeek searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/** Empty blocks the size of the header, the weeks and the summary, so the page doesn't jump when the week streams in. */
function WeekPlaceholder() {
  return (
    <div aria-hidden="true">
      <div className="h-14" />
      <div className="h-11" />
      <div className="h-28 rounded-card bg-surface" />
      <div className="mt-4 h-64 rounded-card bg-surface" />
      <div className="mt-4 h-96 rounded-card bg-surface" />
    </div>
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
  // The whole plan's runs at once: the strip of weeks shows each week's total.
  const activities = activitiesBetween(plan.weeks[0].start, addDays(plan.weeks[plan.weeks.length - 1].start, 6));
  const week = bounds && weekOf(plan, activities, today, day);
  const start = bounds?.start ?? mondayOf(day);
  const thisWeek = weekBounds(plan, today)?.start ?? mondayOf(today);
  const { prev, next } = neighbourWeeks(plan, start);

  const totals = planTotals(plan, activities);
  const previous = totals.find((w) => w.start === addDays(start, -7));
  const last = plan.weeks[plan.weeks.length - 1].index;

  const header = (
    <>
      <header className="flex items-center gap-2">
        <PageLink start={prev} label="Previous week" path="M15 6l-6 6 6 6" />
        <div className="min-w-0 flex-1 text-center">
          <p className="text-sm text-muted">
            {week ? `Week ${week.index} of ${last}${week.cutback ? " · Cutback" : ""}` : "No plan"}
          </p>
          <h1 className="text-2xl font-semibold">
            {shortDate(start)} to {shortDate(addDays(start, 6))}
          </h1>
        </div>
        <PageLink start={next} label="Next week" path="M9 6l6 6-6 6" />
      </header>

      {/* Always one line tall, so the weeks below don't move when you change week. */}
      <div className="flex h-11 items-center justify-center gap-3">
        {start === thisWeek ? (
          <span className="rounded-full bg-accent-soft px-3 py-0.5 text-sm font-medium text-accent-ink">This week</span>
        ) : (
          <>
            <span className="text-sm text-muted">{weeksAway(start, thisWeek)}</span>
            <Link
              href="/week"
              className="flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-accent hover:bg-accent-soft active:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
            >
              Back to this week
            </Link>
          </>
        )}
      </div>

      <WeekPicker weeks={totals} shown={start} thisWeek={thisWeek} />
      {week ? (
        <>
          <Summary week={week} today={today} previous={previous} />
          {connectorUrls() && (
            <div className="mt-4">
              <AskClaude
                question={`Using Cadent, look at my training week of ${week.start}. How is it going, and should I change anything in it?`}
              />
            </div>
          )}
        </>
      ) : (
        <p className="mt-4 rounded-card bg-surface p-6 text-muted">
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

/** The week's one number, then runs, time and pace (or, for a week to come, what's planned). */
function Summary({ week, today, previous }: { week: Week; today: string; previous?: { actual_m: number } }) {
  const future = week.start > today;
  const percent = week.planned_m > 0 ? Math.min(100, (week.actual_m / week.planned_m) * 100) : 0;
  const longest = Math.max(0, ...week.days.flatMap((d) => d.runs.map((r) => r.distance_m)));

  return (
    <section className="mt-4 flex flex-col gap-3.5 rounded-card bg-surface p-6">
      <div>
        <p className="text-4xl font-bold">
          {future ? (
            <>
              {km(week.planned_m)} <span className="text-xl font-medium text-muted">km planned</span>
            </>
          ) : (
            <>
              {km(week.actual_m)} <span className="text-xl font-medium text-muted">/ {km(week.planned_m)} km</span>
            </>
          )}
        </p>
        <p className="mt-2 text-muted">{weekProgress(week, today)}</p>
      </div>

      {!future && (
        <div
          role="progressbar"
          aria-label="Distance this week"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          className="h-2 overflow-hidden rounded-full bg-line"
        >
          {/* The fill width is data, so it can't be a class. */}
          <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {future ? (
          <>
            <Stat value={String(week.runs_planned)} label="Runs planned" />
            <Stat value={longest > 0 ? km(longest) : null} unit="km" label="Long run" />
            <Stat value={String(week.days.reduce((n, d) => n + d.lifts.length, 0))} label="Lifts" />
          </>
        ) : (
          <>
            <Stat value={`${week.runs_done} of ${week.runs_planned}`} label="Runs" />
            <Stat value={week.runs_done > 0 ? hoursMinutes(week.duration_s) : null} unit="h" label="Time" />
            <Stat value={week.pace_s_per_km === null ? null : pace(week.pace_s_per_km)} unit="/km" label="Avg pace" />
          </>
        )}
      </div>

      {!future && previous && (
        <p className="text-sm text-muted">
          Last week {km(previous.actual_m)} km
          {/* A week still going would always look behind, so only a finished one gets the difference. */}
          {week.end < today && ` (${week.actual_m >= previous.actual_m ? "+" : "−"}${km(Math.abs(week.actual_m - previous.actual_m))})`}
        </p>
      )}
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
