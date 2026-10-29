// Overnight wellness Garmin recorded (HRV, sleep, resting HR), read from the SQLite file the
// Python sync script writes. A missing file or table means nothing has synced yet.

import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import { dbPath } from "./activities";
import { addDays } from "./week";

const STATUSES = ["BALANCED", "UNBALANCED", "LOW", "POOR"] as const;

/** Garmin's HRV status. Missing while Garmin is still building a baseline. */
export type HrvStatus = (typeof STATUSES)[number];

function isHrvStatus(status: string | null): status is HrvStatus {
  return STATUSES.includes(status as HrvStatus);
}

export type Wellness = {
  date: string; // local "YYYY-MM-DD", the morning after the night
  hrv_ms: number | null;
  hrv_week_ms: number | null;
  hrv_status: string | null;
  sleep_s: number | null;
  rhr: number | null;
};

export type Readiness = {
  status: HrvStatus | null;
  hrv_ms: number | null;
  hrv_week_ms: number | null;
  sleep_s: number | null;
  usual_sleep_s: number | null;
  rhr: number | null;
  usual_rhr: number | null;
};

/** Wellness dated `from` to `to`, inclusive. */
export function wellnessBetween(from: string, to: string, file = dbPath()): Wellness[] {
  // The database lives outside the build; don't let Turbopack trace the whole project for it.
  if (!existsSync(/*turbopackIgnore: true*/ file)) return [];
  // timeout: wait out the sync's brief write lock instead of failing the page.
  const db = new DatabaseSync(file, { readOnly: true, timeout: 5000 });
  try {
    const table = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'wellness'").get();
    if (!table) return [];
    return db
      .prepare(
        "SELECT date, hrv_ms, hrv_week_ms, hrv_status, sleep_s, rhr FROM wellness WHERE date BETWEEN ? AND ? ORDER BY date",
      )
      .all(from, to) as Wellness[];
  } finally {
    db.close();
  }
}

/** Rounded mean of the numbers present, or null if there are none. */
function usual(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? Math.round(present.reduce((sum, v) => sum + v, 0) / present.length) : null;
}

/**
 * Last night against the 7 nights before it. Undefined when Garmin has nothing for last night.
 * HRV's average is Garmin's own; sleep and resting HR are averaged here.
 */
export function readinessOn(rows: Wellness[], today: string): Readiness | undefined {
  const night = rows.find((r) => r.date === today);
  if (!night || (night.hrv_ms === null && night.sleep_s === null && night.rhr === null)) return undefined;

  const before = rows.filter((r) => addDays(today, -7) <= r.date && r.date < today);
  return {
    status: isHrvStatus(night.hrv_status) ? night.hrv_status : null,
    hrv_ms: night.hrv_ms,
    hrv_week_ms: night.hrv_week_ms,
    sleep_s: night.sleep_s,
    usual_sleep_s: usual(before.map((r) => r.sleep_s)),
    rhr: night.rhr,
    usual_rhr: usual(before.map((r) => r.rhr)),
  };
}
