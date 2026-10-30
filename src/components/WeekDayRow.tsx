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

// One day of the week: what was planned, what was run, and how that compares.
export function WeekDayRow({ day, isToday }: { day: WeekDay; isToday: boolean }) {
  const pill = PILLS[day.status];
  const planned = day.runs.map((run) => `${runTypeLabel(run.type)} ${km(run.distance_m)} km`).join(" + ");
  const detail = note(day);
  const actual = day.actual_m > 0 ? `${km(day.actual_m)} km` : day.status === "upcoming" ? undefined : "–";

  return (
    <li className={`flex items-center gap-3 px-4 py-3 ${isToday ? "bg-accent-soft text-accent-ink" : ""}`}>
      <p className="w-10 font-medium">{weekday(day.date)}</p>
      <div className="min-w-0 flex-1">
        <p className={planned ? "" : "text-muted"}>{planned || "Rest"}</p>
        {detail && <p className={`text-sm ${isToday ? "" : "text-muted"}`}>{detail}</p>}
      </div>
      <div className="text-right">
        {/* Nothing run yet on a day still to come, so no dash either. */}
        {actual && <p className="font-semibold">{actual}</p>}
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
    </li>
  );
}
