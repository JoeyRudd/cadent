// Runs moved to another day of their week, saved from the run detail screen. plan.json stays as
// written; pages read the plan through withMoves. Server-only for the database parts.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { dbPath, readTable } from "./activities";
import { allSessions, isDay, plan, sessionsOn, type Plan } from "./plan";
import { LONG_AFTER_FULL_BODY, REST_DAY, validate } from "./rules";
import { addDays, weekBounds } from "./week";

/** Planned date → the day the run now happens on. Keyed by the plan's date, so moving twice replaces the move. */
export type Moves = Record<string, string>;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS moves (
  from_date TEXT PRIMARY KEY,
  to_date TEXT NOT NULL,
  saved_at TEXT NOT NULL
)`;

/**
 * The plan with each moved run on its new day, carrying its `planned_date`. Lifts stay where the plan
 * put them. A move left over from an older plan.json is ignored when it leaves the run's week or
 * lands on a day that already has a run.
 */
export function withMoves(plan: Plan, moves: Moves): Plan {
  if (Object.keys(moves).length === 0) return plan;
  return {
    ...plan,
    weeks: plan.weeks.map((week) => {
      const end = addDays(week.start, 6);
      const runs = week.sessions.filter((s) => s.kind === "run");
      const taken = new Set(runs.map((r) => r.date));
      const applied = new Map<string, string>();
      for (const { date } of runs) {
        const to = moves[date];
        if (!to || to < week.start || to > end || taken.has(to)) continue;
        taken.delete(date);
        taken.add(to);
        applied.set(date, to);
      }
      return {
        ...week,
        sessions: week.sessions
          .map((s) => (s.kind === "run" && applied.has(s.date) ? { ...s, date: applied.get(s.date)!, planned_date: s.date } : s))
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    }),
  };
}

const hasRun = (plan: Plan, day: string) => sessionsOn(plan, day).some((s) => s.kind === "run");

/**
 * Why the run now on `from` can't move to `to`, or undefined when it can. `moved` is the plan with
 * moves applied: the target must be another day of the same week with no run on it.
 */
export function moveError(moved: Plan, from: string, to: string): string | undefined {
  const week = weekBounds(moved, from);
  if (!hasRun(moved, from)) return "There's no run on that day to move.";
  if (!isDay(to) || !week || to < week.start || to > week.end || to === from) return "Pick another day this week.";
  if (hasRun(moved, to)) return "That day already has a run.";
}

const REST_RULES = new Set([REST_DAY, LONG_AFTER_FULL_BODY]);

/** The rest-day findings for `day`'s week of the moved plan: gentle notes after a move. */
export function moveWarnings(moved: Plan, day: string): string[] {
  const week = weekBounds(moved, day);
  if (!week) return [];
  return validate(allSessions(moved), [])
    .filter((f) => REST_RULES.has(f.code) && week.start <= f.day && f.day <= week.end)
    .map((f) => f.message);
}

/** plan.json with the saved moves applied: what the pages show. A database error shows the plan as written. */
export function currentPlan(file = dbPath()): Plan {
  try {
    return withMoves(plan, savedMoves(file));
  } catch (error) {
    console.error("Couldn't read moved runs", error);
    return plan;
  }
}

/** Every saved move. A missing file or table means nothing has moved. */
export function savedMoves(file = dbPath()): Moves {
  return readTable(
    "moves",
    {},
    (db) => {
      const rows = db.prepare("SELECT from_date, to_date FROM moves").all() as { from_date: string; to_date: string }[];
      return Object.fromEntries(rows.map((r) => [r.from_date, r.to_date]));
    },
    file,
  );
}

/** Saves a move, or with `to` equal to `from` puts the run back on its planned day. Creates the file and table on first use. */
export function saveMove(from: string, to: string, file = dbPath()): void {
  mkdirSync(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
  // timeout: wait out the sync's brief write lock rather than fail the save.
  const db = new DatabaseSync(/*turbopackIgnore: true*/ file, { timeout: 5000 });
  try {
    db.exec(SCHEMA);
    if (to === from) {
      db.prepare("DELETE FROM moves WHERE from_date = ?").run(from);
    } else {
      db.prepare(
        `INSERT INTO moves (from_date, to_date, saved_at) VALUES (?, ?, ?)
         ON CONFLICT(from_date) DO UPDATE SET to_date = excluded.to_date, saved_at = excluded.saved_at`,
      ).run(from, to, new Date().toISOString());
    }
  } finally {
    db.close();
  }
}
