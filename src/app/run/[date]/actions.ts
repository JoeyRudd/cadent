"use server";

import { parseCheckIn, saveCheckIn, type CheckInState } from "@/lib/checkins";

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
