import Link from "next/link";

import { Chevron } from "@/components/Chevron";
import { Stat } from "@/components/Stat";
import { ROW_LINK } from "@/components/iconButton";
import { hoursMinutes, km, pace, weekProgress, weekday } from "@/lib/format";
import type { DayStatus, Week, WeekDay } from "@/lib/week";

// On and off plan as on the Week page's pills.
const CIRCLES: Record<DayStatus, string> = {
  done: "bg-on-plan-soft text-on-plan",
  short: "bg-off-plan-soft text-off-plan",
  over: "bg-off-plan-soft text-off-plan",
  extra: "bg-off-plan-soft text-off-plan",
  missed: "border border-dashed border-line text-muted",
  rest: "border border-dashed border-line text-muted",
  upcoming: "border border-line bg-surface text-ink",
};

/** What goes inside a day's circle: what's planned, what was run, or a mark. */
function circleText(day: WeekDay): string {
  if (day.status === "rest") return "Off";
  if (day.status === "missed") return "–";
  return km(day.status === "upcoming" ? day.planned_m : day.actual_m);
}

// This week at a glance: distance done against the plan, time, pace and runs, then one circle per
// day that opens its run. `previous` is last week's totals, for the line at the bottom.
export function WeekStrip({
  week,
  today,
  previous,
}: {
  week: Week;
  today: string;
  previous?: { planned_m: number; actual_m: number };
}) {
  const percent = week.planned_m > 0 ? Math.min(100, (week.actual_m / week.planned_m) * 100) : 0;

  return (
    <section className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-4.5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">This week</h2>
        <Link
          href="/week"
          className={`-my-2 -mr-2 flex min-h-11 items-center gap-1 rounded-button px-2 text-sm font-medium text-accent ${ROW_LINK}`}
        >
          Week {week.index}
          <Chevron />
        </Link>
      </div>

      <div>
        <p className="flex items-baseline gap-1.5">
          <span className="text-4xl font-bold">{km(week.actual_m)}</span>
          <span className="text-muted">of {km(week.planned_m)} km</span>
        </p>
        <p className="mt-0.5 text-sm text-muted">{weekProgress(week, today)}</p>
      </div>

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

      <div className="grid grid-cols-3 gap-3">
        <Stat value={`${week.runs_done} of ${week.runs_planned}`} label="Runs" />
        <Stat value={week.runs_done > 0 ? hoursMinutes(week.duration_s) : null} unit="h" label="Time" />
        <Stat value={week.pace_s_per_km === null ? null : pace(week.pace_s_per_km)} unit="/km" label="Avg pace" />
      </div>

      <ol className="-mx-2 grid grid-cols-7">
        {week.days.map((day) => {
          const isToday = day.date === today;
          const circle = (
            <>
              <span aria-hidden="true" className="text-xs text-muted">
                {weekday(day.date).charAt(0)}
              </span>
              {/* Colour carries the status on screen; say it in words for screen readers. */}
              <span className="sr-only">
                {weekday(day.date)}, {isToday ? "today, " : ""}
                {day.status}:
              </span>
              <span
                className={`flex size-9.5 items-center justify-center rounded-full text-xs font-semibold ${
                  isToday ? "bg-accent text-on-accent" : CIRCLES[day.status]
                }`}
              >
                {circleText(day)}
              </span>
            </>
          );
          const column = "flex min-h-11 flex-col items-center gap-1.5 py-1";
          return (
            <li key={day.date}>
              {day.runs.length > 0 || day.recorded > 0 ? (
                <Link href={`/run/${day.date}`} className={`${column} rounded-button ${ROW_LINK}`}>
                  {circle}
                </Link>
              ) : (
                <div className={column}>{circle}</div>
              )}
            </li>
          );
        })}
      </ol>

      {previous && (
        <p className="text-sm text-muted">
          Last week {km(previous.actual_m)} of {km(previous.planned_m)} km
        </p>
      )}
    </section>
  );
}
