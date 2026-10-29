"use client";

import { useActionState, useState } from "react";

import { PRIMARY_BUTTON } from "@/components/iconButton";
import type { CheckIn as Saved, CheckInState } from "@/lib/checkins";

const EFFORTS = Array.from({ length: 10 }, (_, i) => i + 1);

// After a run: how hard it felt (1–10) and whether anything hurt. Client-side for the selections.
// `saved` is the day's earlier check-in, which the form starts from.
export function CheckIn({
  action,
  saved,
}: {
  action: (prev: CheckInState, form: FormData) => Promise<CheckInState>;
  saved?: Saved;
}) {
  const [state, formAction, pending] = useActionState(action, { saved });
  const [effort, setEffort] = useState(saved?.effort);
  const [pain, setPain] = useState(saved?.pain);
  const unchanged = state.saved !== undefined && state.saved.effort === effort && state.saved.pain === pain;

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <h2 className="font-semibold">How did it feel?</h2>

      <div role="radiogroup" aria-label="Effort" className="grid grid-cols-10 gap-1">
        {EFFORTS.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={effort === n}
            aria-label={`Effort ${n} of 10`}
            onClick={() => setEffort(n)}
            className={`h-11 rounded-lg text-sm font-semibold ${
              effort === n ? "bg-accent text-on-accent" : "border border-line bg-bg text-ink"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p id="pain" className="text-sm">
          Any pain (not soreness)?
        </p>
        <div role="radiogroup" aria-labelledby="pain" className="flex gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={pain === false}
            onClick={() => setPain(false)}
            className={`h-11 rounded-full px-4 text-sm font-semibold ${
              pain === false ? "bg-on-plan-soft text-on-plan" : "border border-line text-ink"
            }`}
          >
            No
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={pain === true}
            onClick={() => setPain(true)}
            className={`h-11 rounded-full px-4 text-sm font-semibold ${
              pain === true ? "border border-warning text-warning" : "border border-line text-ink"
            }`}
          >
            Yes
          </button>
        </div>
      </div>

      <input type="hidden" name="effort" value={effort ?? ""} />
      <input type="hidden" name="pain" value={pain === undefined ? "" : Number(pain)} />
      <button
        type="submit"
        disabled={effort === undefined || pain === undefined || pending || unchanged}
        className={PRIMARY_BUTTON}
      >
        {pending ? "Saving…" : unchanged ? "Saved" : "Save check-in"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-off-plan">
          {state.error}
        </p>
      )}
    </form>
  );
}
