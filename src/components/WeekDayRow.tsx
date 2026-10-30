import Link from "next/link";

import { Chevron } from "@/components/Chevron";
import { StatusPill } from "@/components/StatusPill";
import { FOCUS_RING, ROW_LINK } from "@/components/iconButton";
import { changedNote, dayOfMonth, km, runTypeLabel, timeAndPace, weekday } from "@/lib/format";
import type { WeekDay } from "@/lib/week";

/** Gentle words for an off-plan day. */
function note({ status, planned_m, actual_m }: WeekDay): string | undefined {
  const gap = km(Math.abs(planned_m - actual_m));
  if (status === "short") return `${gap} km short, that's fine`;
  if (status === "over") return `${gap} km over, keep the next one easy`;
  if (status === "missed") return "Skipped, that's fine";
  if (status === "extra") return "Bonus run";
}

/** While a run is being dragged, what this day would do with it. */
export type DropState = "free" | "over" | "taken";

const DROP_TEXT: Record<DropState, string> = {
  free: "Move here",
  over: "Drop here",
  taken: "Has a run",
};

// One day of the week: what was planned, what was run, and how that compares. A day with a run
// links to its detail. `drop` marks the row while WeekBoard drags a run.
export function WeekDayRow({ day, isToday, drop }: { day: WeekDay; isToday: boolean; drop?: DropState }) {
  const ran = day.recorded > 0;
  const hasRun = day.runs.length > 0 || ran;
  const planned = day.runs.map((run) => runTypeLabel(run.type)).join(" + ");
  const lifts = day.lifts.map((lift) => (lift.after_run ? `${lift.name}, after the run` : lift.name)).join(" + ");
  const detail = note(day);
  const changed = day.runs.map(changedNote).find((n) => n !== undefined);
  const recorded = ran
    ? `${timeAndPace(day.duration_s, day.pace_s_per_km)}${day.recorded > 1 ? ` · ${day.recorded} runs` : ""}`
    : undefined;
  const actual = day.actual_m > 0 ? `${km(day.actual_m)} km` : undefined;
  const tint = drop === "over" ? "bg-accent text-on-accent" : isToday ? "bg-accent-soft text-accent-ink" : "";
  const outline = drop === "free" ? "outline-2 -outline-offset-4 outline-dashed outline-accent" : "";
  const quiet = isToday || drop === "over" ? "" : "text-muted";
  const size = hasRun || lifts ? "min-h-16 py-3" : "min-h-12 py-2";
  const className = `flex items-center gap-3 px-4 ${size} ${tint} ${outline}`;
  const link = tint ? FOCUS_RING : ROW_LINK;

  const content = (
    <>
      <div className="w-10 text-center">
        <p className={`text-xs font-medium uppercase ${quiet}`}>{weekday(day.date)}</p>
        <p className="text-lg font-semibold">
          {dayOfMonth(day.date)}
          {isToday && <span className="sr-only"> (today)</span>}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        {planned ? (
          <p className="font-medium">
            {planned} <span className={`whitespace-nowrap font-normal ${quiet}`}>{km(day.planned_m)} km</span>
          </p>
        ) : (
          <p className={ran ? "font-medium" : quiet}>{ran ? "Run" : lifts ? "No run" : "Rest"}</p>
        )}
        {changed && <p className={`text-sm ${quiet}`}>{changed}</p>}
        {recorded && <p className={`text-sm ${quiet}`}>{recorded}</p>}
        {lifts && <p className={`text-sm ${quiet}`}>Lift: {lifts}</p>}
        {detail && <p className={`text-sm ${quiet}`}>{detail}</p>}
      </div>
      {drop ? (
        <p className={`text-sm font-semibold ${drop === "taken" ? quiet : ""}`}>{DROP_TEXT[drop]}</p>
      ) : (
        <div className="flex w-20 flex-col items-end gap-1">
          {actual && <p className="font-semibold">{actual}</p>}
          <StatusPill status={day.status} />
        </div>
      )}
      {hasRun && !drop && <Chevron />}
    </>
  );

  return hasRun ? (
    <Link href={`/run/${day.date}?from=week`} draggable={false} className={`${className} ${link}`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
