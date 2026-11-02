"use server";

import { refresh } from "next/cache";

import { LIFT_NAMES, saveLiftDay } from "@/lib/lifts";
import { savedPlan, savedWarnings } from "@/lib/moves";
import { isDay, plan, sessionsOn } from "@/lib/plan";

/** What marking a day did: why it couldn't, or the week's rest-day notes as it now stands. */
export type LiftResult = { error: string } | { warnings: string[] };

/**
 * Toggles the form's `date`: takes its lift off if it has one, or marks it with the form's `name`, then
 * refreshes the page. The day and name come from the client, so they're checked first.
 */
export async function toggleLiftDay(_prev: LiftResult | undefined, form: FormData): Promise<LiftResult> {
  const date = String(form.get("date"));
  const picked = String(form.get("name"));
  if (!isDay(date) || !(LIFT_NAMES as readonly string[]).includes(picked)) {
    return { error: "Pick a day and a kind of lift." };
  }
  try {
    // savedPlan, not currentPlan: a read error should fail the change, not toggle the plan as written.
    const has = sessionsOn(savedPlan(), date).some((s) => s.kind === "lift");
    const name = has ? null : picked;
    // The plan's own lift that day, so marking the day back to it clears the change.
    const planned = sessionsOn(plan, date).find((s) => s.kind === "lift")?.name ?? null;
    saveLiftDay(date, name, planned);
  } catch (error) {
    console.error("Couldn't save lift day", error);
    return { error: "Couldn't save. Try again in a moment." };
  }
  // Outside the try: a saved lift day must never report a failure.
  refresh();
  return { warnings: savedWarnings(date) };
}
