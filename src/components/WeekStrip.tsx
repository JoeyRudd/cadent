import { km, weekday } from "@/lib/format";
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
  if (day.status === "rest") return day.lifts.length > 0 ? "Lift" : "Off";
  if (day.status === "missed") return "–";
  return km(day.status === "upcoming" ? day.planned_m : day.actual_m);
}

// This week at a glance: distance done against the plan, then one circle per day.
export function WeekStrip({ week, today }: { week: Week; today: string }) {
  const percent = week.planned_m > 0 ? Math.min(100, (week.actual_m / week.planned_m) * 100) : 0;

  return (
    <section className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-4.5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">This week</h2>
        <p className="text-sm text-muted">
          <span className="font-bold text-ink">{km(week.actual_m)}</span> of {km(week.planned_m)} km
        </p>
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

      <ol className="grid grid-cols-7 gap-1.5">
        {week.days.map((day) => {
          const isToday = day.date === today;
          return (
            <li key={day.date} className="flex flex-col items-center gap-1.5">
              <span aria-hidden="true" className="text-xs text-muted">
                {weekday(day.date).charAt(0)}
              </span>
              {/* Colour carries the status on screen; say it in words for screen readers. */}
              <span className="sr-only">
                {weekday(day.date)}, {isToday ? "today, " : ""}
                {day.status}
                {day.lifts.length > 0 ? ", lift" : ""}:
              </span>
              <span
                className={`flex size-9.5 items-center justify-center rounded-full text-xs font-semibold ${
                  isToday ? "bg-accent text-on-accent" : CIRCLES[day.status]
                }`}
              >
                {circleText(day)}
              </span>
              {/* A run day's lift goes under its circle; a rest day's is in the circle itself. */}
              {day.status !== "rest" && day.lifts.length > 0 && <span className="text-xs text-muted">Lift</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
