// Runs Garmin recorded, read from the SQLite file the Python sync script writes.
// Server-only. A missing file or table means nothing has synced yet: no activities.

import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Activity = {
  id: string;
  date: string; // local "YYYY-MM-DD"
  type: string;
  distance_m: number;
  duration_s: number;
  avg_hr: number | null;
};

export function dbPath(): string {
  return process.env.CADENT_DB ?? path.join(process.cwd(), "data", "cadent.db");
}

/** Activities dated `from` to `to`, inclusive. */
export function activitiesBetween(from: string, to: string, file = dbPath()): Activity[] {
  // The database lives outside the build; don't let Turbopack trace the whole project for it.
  if (!existsSync(/*turbopackIgnore: true*/ file)) return [];
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const table = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'activities'").get();
    if (!table) return [];
    return db
      .prepare(
        "SELECT id, date, type, distance_m, duration_s, avg_hr FROM activities WHERE date BETWEEN ? AND ? ORDER BY date",
      )
      .all(from, to) as Activity[];
  } finally {
    db.close();
  }
}
