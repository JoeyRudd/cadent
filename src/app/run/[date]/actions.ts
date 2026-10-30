"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { parseCheckIn, saveCheckIn, type CheckInState } from "@/lib/checkins";
import { tryMove, type MoveResult } from "@/lib/moves";

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

/** Moves the run now on `from` to `to` and refreshes the page. */
export async function moveRun(from: string, to: string): Promise<MoveResult> {
  try {
    const result = tryMove(from, to);
    if (!("error" in result)) refresh();
    return result;
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
