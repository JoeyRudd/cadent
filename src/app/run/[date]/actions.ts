"use server";

import { redirect } from "next/navigation";

import { parseCheckIn, saveCheckIn, type CheckInState } from "@/lib/checkins";
import { moveError, saveMove, savedMoves, withMoves } from "@/lib/moves";
import { plan, sessionsOn, type Run } from "@/lib/plan";

/** Saves the run's check-in from the form. The date and fields come from the client, so they're checked first. */
export async function saveCheckInFor(date: string, _prev: CheckInState, form: FormData): Promise<CheckInState> {
  const checkIn = parseCheckIn(date, form);
  if (!checkIn) return { error: "Pick an effort and answer the pain question." };
  try {
    saveCheckIn(checkIn);
    return { saved: checkIn };
  } catch (error) {
    console.error("Couldn't save check-in", error);
    return { error: "Couldn't save. Try again in a moment." };
  }
}

/** Moves the run now on `day` to the form's `to` day, then opens it there. Returns an error message instead when it can't. */
export async function moveRunFor(day: string, _prev: string | undefined, form: FormData): Promise<string | undefined> {
  const to = String(form.get("to"));
  try {
    // savedMoves, not currentPlan: a read error should fail the move, not check it against the plan as written.
    const moved = withMoves(plan, savedMoves());
    const error = moveError(moved, day, to);
    if (error) return error;
    const run = sessionsOn(moved, day).find((s): s is Run => s.kind === "run");
    // Keyed by the plan's date, so a second move replaces the first and moving back deletes it.
    saveMove(run?.planned_date ?? day, to);
  } catch (error) {
    console.error("Couldn't move run", error);
    return "Couldn't move the run. Try again in a moment.";
  }
  redirect(`/run/${to}`);
}
