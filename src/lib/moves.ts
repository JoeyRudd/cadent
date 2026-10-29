// Runs moved to another day of their week, saved from the run detail screen. plan.json stays as
// written; pages read the plan through withMoves. Server-only for the database parts.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { dbPath, readTable } from "./activities";
import { isDay, plan, sessionsOn, type Plan, type Run } from "./plan";
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

/** The days of its week the run now on `from` can move to, by moveError's rules. */
export function moveTargets(moved: Plan, from: string): string[] {
  const week = weekBounds(moved, from);
  if (!week) return [];
  return Array.from({ length: 7 }, (_, i) => addDays(week.start, i)).filter((to) => !moveError(moved, from, to));
}

/** Gentle notes on the run's week as it now stands, from the plan's rest-day rules. */
export function moveWarnings(moved: Plan, day: string): string[] {
  const week = weekBounds(moved, day);
  if (!week) return [];
  const days = Array.from({ length: 7 }, (_, i) => addDays(week.start, i));
  const warnings: string[] = [];
  if (days.every((d) => sessionsOn(moved, d).length > 0)) {
    warnings.push("No full rest day this week. Keep one day free of running and lifting.");
  }
  const longRun = days
    .flatMap((d) => sessionsOn(moved, d))
    .find((s): s is Run => s.kind === "run" && s.type === "long");
  if (longRun && sessionsOn(moved, addDays(longRun.date, -1)).some((s) => s.kind === "lift" && s.name.startsWith("Full-body"))) {
    warnings.push("The long run is the day after a full-body lift. The plan keeps those apart.");
  }
  return warnings;
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
