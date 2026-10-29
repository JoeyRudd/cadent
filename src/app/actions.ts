"use server";

import { refresh } from "next/cache";

import { syncGarmin } from "@/lib/sync";

/** Pulls the latest runs and wellness from Garmin and re-renders the page; returns an error message on failure. */
export async function syncNow(): Promise<string | undefined> {
  const error = await syncGarmin();
  if (!error) refresh();
  return error;
}
