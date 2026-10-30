// Runs Garmin recorded, read from the SQLite file the Python sync script writes.
// Server-only. A missing file or table means nothing has synced yet: no activities.

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { joinDetails } from "./run";
import { isRun } from "./week";

export type Activity = {
  id: string;
  date: string; // local "YYYY-MM-DD"
  type: string;
  distance_m: number;
  duration_s: number;
  avg_hr: number | null;
};

export function dbPath(): string {
  // `||`, not `??`: .env leaves CADENT_DB empty to mean the default.
  return process.env.CADENT_DB || path.join(process.cwd(), "data", "cadent.db");
}

/** `read` against the database, or `fallback` while the file or `table` doesn't exist yet. */
export function readTable<T>(table: string, fallback: T, read: (db: DatabaseSync) => T, file = dbPath()): T {
  // The database lives outside the build; don't let Turbopack trace the whole project for it.
  if (!existsSync(/*turbopackIgnore: true*/ file)) return fallback;
  // timeout: wait out the sync's brief write lock instead of failing the page.
  const db = new DatabaseSync(file, { readOnly: true, timeout: 5000 });
  try {
    const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
    return exists ? read(db) : fallback;
  } finally {
    db.close();
  }
}

/** `run` against the database after `schema` (CREATE TABLE IF NOT EXISTS ...), creating the file on first use. */
export function writeTable<T>(schema: string, run: (db: DatabaseSync) => T, file = dbPath()): T {
  mkdirSync(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
  // timeout: wait out the sync's brief write lock rather than fail the save.
  const db = new DatabaseSync(/*turbopackIgnore: true*/ file, { timeout: 5000 });
  try {
    db.exec(schema);
    return run(db);
  } finally {
    db.close();
  }
}

/** Activities dated `from` to `to`, inclusive. */
export function activitiesBetween(from: string, to: string, file = dbPath()): Activity[] {
  return readTable(
    "activities",
    [],
    (db) =>
      db
        .prepare(
          "SELECT id, date, type, distance_m, duration_s, avg_hr FROM activities WHERE date BETWEEN ? AND ? ORDER BY date",
        )
        .all(from, to) as Activity[],
    file,
  );
}

/** One Garmin lap (usually 1 km, or a workout step); null when the watch didn't record it. */
export type Lap = {
  distance_m: number;
  duration_s: number;
  avg_hr: number | null;
  max_hr: number | null;
  elev_gain_m: number | null;
  cadence_spm: number | null;
};

/** One sample along the run. */
export type Point = {
  t_s: number;
  distance_m: number;
  hr: number | null;
  speed_m_s: number | null;
  elev_m: number | null;
};

export type Details = { laps: Lap[]; points: Point[] };

type Row = { activity_id: string; laps: string; points: string };

/** Laps and samples for each id the sync has fetched them for, keyed by activity id. */
export function detailsFor(ids: string[], file = dbPath()): Map<string, Details> {
  if (ids.length === 0) return new Map();
  return readTable(
    "details",
    new Map(),
    (db) => {
      const rows = db
        .prepare(`SELECT activity_id, laps, points FROM details WHERE activity_id IN (${ids.map(() => "?").join(", ")})`)
        .all(...ids) as Row[];
      return new Map(
        rows.map((row) => [
          row.activity_id,
          {
            laps: (JSON.parse(row.laps) as number[][]).map(
              ([distance_m, duration_s, avg_hr, max_hr, elev_gain_m, cadence_spm]) => ({
                distance_m,
                duration_s,
                avg_hr,
                max_hr,
                elev_gain_m,
                cadence_spm,
              }),
            ),
            points: (JSON.parse(row.points) as number[][]).map(([t_s, distance_m, hr, speed_m_s, elev_m]) => ({
              t_s,
              distance_m,
              hr,
              speed_m_s,
              elev_m,
            })),
          },
        ]),
      );
    },
    file,
  );
}

/** The day's runs' laps and samples as one run, or undefined when the sync hasn't fetched any. `activities` are that day's. */
export function dayDetails(activities: Activity[], file = dbPath()): Details | undefined {
  const runs = activities.filter(isRun);
  const found = detailsFor(runs.map((a) => a.id), file);
  const details = runs.map((a) => found.get(a.id)).filter((d) => d !== undefined);
  return details.length > 0 ? joinDetails(details) : undefined;
}
