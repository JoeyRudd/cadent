import Link from "next/link";

import { km, runTypeLabel, weekday } from "@/lib/format";
import type { DayStatus, WeekDay } from "@/lib/week";

const PILLS: Partial<Record<DayStatus, { label: string; onPlan: boolean }>> = {
  done: { label: "On plan", onPlan: true },
  short: { label: "Short", onPlan: false },
  over: { label: "Over", onPlan: false },
  missed: { label: "Missed", onPlan: false },
  extra: { label: "Extra", onPlan: false },
};

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
  const pill = PILLS[day.status];
  const planned = day.runs.map((run) => `${runTypeLabel(run.type)} ${km(run.distance_m)} km`).join(" + ");
  const lifts = day.lifts.map((lift) => (lift.after_run ? `${lift.name}, after the run` : lift.name)).join(" + ");
  const detail = note(day);
  const tint = drop === "over" ? "bg-accent text-on-accent" : isToday ? "bg-accent-soft text-accent-ink" : "";
  const outline = drop === "free" ? "outline-2 -outline-offset-4 outline-dashed outline-accent" : "";
  const quiet = isToday || drop === "over" ? "" : "text-muted";
  const className = `flex min-h-16 items-center gap-3 px-4 py-3 ${tint} ${outline}`;

  const content = (
    <>
      <p className="w-10 font-medium">{weekday(day.date)}</p>
      <div className="min-w-0 flex-1">
        <p className={planned ? "" : quiet}>{planned || (lifts ? "No run" : "Rest")}</p>
        {lifts && <p className={`text-sm ${quiet}`}>Lift: {lifts}</p>}
        {detail && <p className={`text-sm ${quiet}`}>{detail}</p>}
      </div>
      {drop ? (
        <p className={`text-sm font-semibold ${drop === "taken" ? quiet : ""}`}>{DROP_TEXT[drop]}</p>
      ) : (
        <div className="text-right">
          <p className="font-semibold">{day.actual_m > 0 ? `${km(day.actual_m)} km` : "–"}</p>
          {pill && (
            <p
              className={`mt-1 rounded-full px-2 text-xs font-medium ${
                pill.onPlan ? "bg-on-plan-soft text-on-plan" : "bg-off-plan-soft text-off-plan"
              }`}
            >
              {pill.label}
            </p>
          )}
        </div>
      )}
    </>
  );

  return day.runs.length > 0 ? (
    <Link href={`/run/${day.date}`} draggable={false} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
