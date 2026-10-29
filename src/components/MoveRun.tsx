"use client";

import { useActionState } from "react";

import { weekday } from "@/lib/format";

export type MoveDay = { date: string; free: boolean };

// Run detail: move this run to another day of its week. `days` is Monday to Sunday; a day is free
// when the run can move there. `plannedOn` is the plan's day when the run has been moved, for "Move back".
export function MoveRun({
  action,
  days,
  current,
  plannedOn,
  warnings,
}: {
  action: (prev: string | undefined, form: FormData) => Promise<string | undefined>;
  days: MoveDay[];
  current: string;
  plannedOn?: string;
  warnings: string[];
}) {
  const [error, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <div>
        <h2 className="font-semibold">Move this run</h2>
        <p className="text-sm text-muted">
          {plannedOn ? `Moved from ${weekday(plannedOn)}.` : "Pick another day this week."}
        </p>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isCurrent = day.date === current;
          return (
            <button
              key={day.date}
              type="submit"
              name="to"
              value={day.date}
              disabled={pending || !day.free}
              aria-label={`Move to ${weekday(day.date)}`}
              aria-current={isCurrent ? "date" : undefined}
              className={`h-11 rounded-lg text-sm font-semibold disabled:opacity-50 ${
                isCurrent ? "bg-accent text-on-accent disabled:opacity-100" : "border border-line bg-bg text-ink"
              }`}
            >
              {weekday(day.date).slice(0, 1)}
            </button>
          );
        })}
      </div>

      {plannedOn && (
        <button
          type="submit"
          name="to"
          value={plannedOn}
          disabled={pending || !days.find((d) => d.date === plannedOn)?.free}
          className="h-11 rounded-button border border-line text-sm font-semibold text-ink disabled:opacity-50"
        >
          Move back to {weekday(plannedOn)}
        </button>
      )}

      {warnings.map((warning) => (
        <p key={warning} className="text-sm text-warning">
          {warning}
        </p>
      ))}
      {error && (
        <p role="alert" className="text-sm text-off-plan">
          {error}
        </p>
      )}
    </form>
  );
}
