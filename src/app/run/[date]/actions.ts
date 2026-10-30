"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { parseCheckIn, saveCheckIn, type CheckInState } from "@/lib/checkins";
import { moveError, moveWarnings, saveMove, savedMoves, withMoves } from "@/lib/moves";
import { plan, sessionsOn, type Run } from "@/lib/plan";

/** Saves the run's check-in from the form. The date and fields come from the client, so they're checked first. */
export async function saveCheckInFor(date: string, _prev: CheckInState, form: FormData): Promise<CheckInState> {
  const checkIn = parseCheckIn(date, form);
  if (!checkIn) return { error: "Pick an effort and answer the pain question." };
  try {
    saveCheckIn(checkIn);
  } catch (error) {
    console.error("Couldn't save check-in", error);
    return { error: "Couldn't save. Try again in a moment." };
  }
  // Outside the try: a saved check-in must never report a failure.
  refresh();
  return { saved: checkIn };
}

/** What a move did: why it couldn't happen, or the week's rest-day notes as it now stands. */
export type MoveResult = { error: string } | { warnings: string[] };

/** Moves the run now on `from` to `to` and refreshes the page. The days come from the client, so they're checked first. */
export async function moveRun(from: string, to: string): Promise<MoveResult> {
  try {
    // savedMoves, not currentPlan: a read error should fail the move, not check it against the plan as written.
    const moves = savedMoves();
    const moved = withMoves(plan, moves);
    const error = moveError(moved, from, to);
    if (error) return { error };
    const run = sessionsOn(moved, from).find((s): s is Run => s.kind === "run");
    // Keyed by the plan's date, so a second move replaces the first and moving back deletes it.
    const planned = run?.planned_date ?? from;
    saveMove(planned, to);
    refresh();
    // A move back onto the planned day is ignored by withMoves, the same as the deleted row.
    return { warnings: moveWarnings(withMoves(plan, { ...moves, [planned]: to }), to) };
  } catch (error) {
    console.error("Couldn't move run", error);
    return { error: "Couldn't move the run. Try again in a moment." };
  }
}

/** Moves the run now on `day` to the form's `to` day, then opens it there. Returns an error message instead when it can't. */
export async function moveRunFor(day: string, _prev: string | undefined, form: FormData): Promise<string | undefined> {
  const to = String(form.get("to"));
  const result = await moveRun(day, to);
  if ("error" in result) return result.error;
  redirect(`/run/${to}`);
}
