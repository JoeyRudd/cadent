"use client";

import { useActionState, useState } from "react";

import type { LiftResult } from "@/app/week/actions";
import { weekday } from "@/lib/format";

export type LiftDay = { date: string; lift?: string };

// Week: tap a day to mark it as a lift day with the kind picked above, or tap a marked day to take its
// lift off. Moving a lift is taking it off one day and marking another. `days` is Monday to Sunday.
export function LiftDays({
  action,
  days,
  names,
}: {
  action: (prev: LiftResult | undefined, form: FormData) => Promise<LiftResult>;
  days: LiftDay[];
  names: readonly string[];
}) {
  const [result, formAction, pending] = useActionState(action, undefined);
  const [name, setName] = useState(names[0]);

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <div>
        <h2 className="font-semibold">Lift days</h2>
        <p className="text-sm text-muted">Tap a day to add a lift, or tap a lift day to take it off.</p>
      </div>

      <fieldset className="flex gap-1 rounded-button bg-bg p-1">
        <legend className="sr-only">Kind of lift to add</legend>
        {names.map((n) => (
          <label
            key={n}
            className={`flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold has-focus-visible:outline-2 has-focus-visible:outline-accent ${
              n === name ? "bg-surface text-ink shadow-sm" : "text-muted"
            }`}
          >
            <input type="radio" name="name" value={n} className="sr-only" checked={n === name} onChange={() => setName(n)} />
            {n}
          </label>
        ))}
      </fieldset>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => (
          <button
            key={day.date}
            type="submit"
            name="date"
            value={day.date}
            disabled={pending}
            aria-pressed={day.lift !== undefined}
            aria-label={day.lift ? `${weekday(day.date)}: ${day.lift}. Take it off` : `Add a lift on ${weekday(day.date)}`}
            className={`flex h-14 flex-col items-center justify-center rounded-lg text-sm font-semibold disabled:opacity-50 ${
              day.lift ? "bg-accent text-on-accent" : "border border-line bg-bg text-ink"
            }`}
          >
            {weekday(day.date).slice(0, 1)}
            <span className="text-xs font-medium">{day.lift ? "Lift" : "+"}</span>
          </button>
        ))}
      </div>

      {result && "warnings" in result &&
        result.warnings.map((warning) => (
          <p key={warning} className="text-sm text-warning">
            {warning}
          </p>
        ))}
      {result && "error" in result && (
        <p role="alert" className="text-sm text-off-plan">
          {result.error}
        </p>
      )}
    </form>
  );
}
