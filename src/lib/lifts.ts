// Lift days marked from the Week screen: a lift added to a day, or a plan lift taken off one.
// plan.json stays as written; pages read the plan through withLifts. Server-only for the database parts.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { dbPath, readTable } from "./activities";
import type { Lift, Plan } from "./plan";
import { addDays } from "./week";

/** The kinds of lift a day can be marked with. "Full-body" keeps the plan's rest-day rules counting it. */
export const LIFT_NAMES = ["Full-body", "Upper body", "Lower body"] as const;

/** Day → its lift's name, or null for a day marked as no lift. */
export type LiftDays = Record<string, string | null>;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS lift_days (
  date TEXT PRIMARY KEY,
  name TEXT,
  saved_at TEXT NOT NULL
)`;

/** The plan with each marked day's lifts replaced by the marked one, or by none. A day outside the plan is ignored. */
export function withLifts(plan: Plan, days: LiftDays): Plan {
  if (Object.keys(days).length === 0) return plan;
  return {
    ...plan,
    weeks: plan.weeks.map((week) => {
      const end = addDays(week.start, 6);
      const marked = Object.entries(days).filter(([date]) => week.start <= date && date <= end);
      if (marked.length === 0) return week;
      const added = marked.flatMap(([date, name]): Lift[] => (name ? [{ date, kind: "lift", name }] : []));
      return {
        ...week,
        sessions: [...week.sessions.filter((s) => s.kind !== "lift" || !(s.date in days)), ...added].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      };
    }),
  };
}

/** Every marked day. A missing file or table means nothing is marked. */
export function savedLiftDays(file = dbPath()): LiftDays {
  return readTable(
    "lift_days",
    {},
    (db) => {
      const rows = db.prepare("SELECT date, name FROM lift_days").all() as { date: string; name: string | null }[];
      return Object.fromEntries(rows.map((r) => [r.date, r.name]));
    },
    file,
  );
}

/**
 * Marks `date` with a lift called `name`, or with null as no lift. `plannedName` is the plan's own lift
 * that day, if any: marking the day back to it deletes the row, so the plan as written shows again.
 */
export function saveLiftDay(date: string, name: string | null, plannedName?: string | null, file = dbPath()): void {
  mkdirSync(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
  // timeout: wait out the sync's brief write lock rather than fail the save.
  const db = new DatabaseSync(/*turbopackIgnore: true*/ file, { timeout: 5000 });
  try {
    db.exec(SCHEMA);
    if (name === (plannedName ?? null)) {
      db.prepare("DELETE FROM lift_days WHERE date = ?").run(date);
    } else {
      db.prepare(
        `INSERT INTO lift_days (date, name, saved_at) VALUES (?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET name = excluded.name, saved_at = excluded.saved_at`,
      ).run(date, name, new Date().toISOString());
    }
  } finally {
    db.close();
  }
}
