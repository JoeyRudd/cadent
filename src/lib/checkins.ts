// How each run felt, saved from the run detail screen: the app's only write to the database.
// Server-only. One check-in per day; saving again replaces it.

import { dbPath, readTable, writeTable } from "./activities";
import { isDay } from "./plan";

export type CheckIn = {
  date: string; // local "YYYY-MM-DD"
  effort: number; // 1–10
  pain: boolean;
};

/** What the check-in form last saved, or why saving failed. */
export type CheckInState = { saved?: CheckIn; error?: string };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS checkins (
  date TEXT PRIMARY KEY,
  effort INTEGER NOT NULL CHECK (effort BETWEEN 1 AND 10),
  pain INTEGER NOT NULL CHECK (pain IN (0, 1)),
  saved_at TEXT NOT NULL
)`;

/** The check-in form's fields as a check-in, or undefined if anything is missing or out of range. */
export function parseCheckIn(date: string, form: FormData): CheckIn | undefined {
  const effort = Number(form.get("effort"));
  const pain = form.get("pain");
  if (!isDay(date) || !Number.isInteger(effort) || effort < 1 || effort > 10) return undefined;
  if (pain !== "0" && pain !== "1") return undefined;
  return { date, effort, pain: pain === "1" };
}

/** The check-in saved for `date`, if any. */
export function checkInOn(date: string, file = dbPath()): CheckIn | undefined {
  return readTable(
    "checkins",
    undefined,
    (db) => {
      const row = db.prepare("SELECT effort, pain FROM checkins WHERE date = ?").get(date) as
        | { effort: number; pain: number }
        | undefined;
      return row && { date, effort: row.effort, pain: row.pain === 1 };
    },
    file,
  );
}

/** Saves the day's check-in, replacing any earlier one. Creates the file and table on first use. */
export function saveCheckIn({ date, effort, pain }: CheckIn, file = dbPath()): void {
  writeTable(
    SCHEMA,
    (db) =>
      db
        .prepare(
          `INSERT INTO checkins (date, effort, pain, saved_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(date) DO UPDATE SET effort = excluded.effort, pain = excluded.pain, saved_at = excluded.saved_at`,
        )
        .run(date, effort, pain ? 1 : 0, new Date().toISOString()),
    file,
  );
}
