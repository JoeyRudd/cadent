// Planned runs made longer or shorter, saved from Claude (mcp.ts). plan.json stays as written; pages
// read the plan through currentPlan (moves.ts), which applies these before the moves. Server-only for
// the database parts.

import { activitiesBetween, dbPath, readTable, writeTable, type Activity } from "./activities";
import { checkPlan, historyRange } from "./check";
import { km } from "./format";
import { plan as written, runOn, type Plan } from "./plan";

/** Planned date → the run's new distance in metres. Keyed by the plan's date, like Moves. */
export type Changes = Record<string, number>;

/** Shorter than a shakeout or longer than an ultra is a typo, not a plan. */
export const MIN_M = 1000;
export const MAX_M = 50_000;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS changes (
  planned_date TEXT PRIMARY KEY,
  distance_m INTEGER NOT NULL,
  saved_at TEXT NOT NULL
)`;

/** The plan with each changed run at its new distance. Apply before withMoves: changes are keyed by the plan's date. */
export function withChanges(plan: Plan, changes: Changes): Plan {
  if (Object.keys(changes).length === 0) return plan;
  return {
    ...plan,
    weeks: plan.weeks.map((week) => ({
      ...week,
      sessions: week.sessions.map((s) =>
        s.kind === "run" && changes[s.date] !== undefined
          ? { ...s, distance_m: changes[s.date], planned_distance_m: s.planned_distance_m ?? s.distance_m }
          : s,
      ),
    })),
  };
}

/** What a change would do: why it can't happen, or the safety warnings the plan would then have on that day. */
export type ChangeResult = { error: string } | { warnings: string[] };

/**
 * Checks setting the run planned on `planned`, and now on `day` (another day once it's moved), to
 * `distance_m` against the safety rules: the change is refused when it adds an error-level finding the
 * plan didn't already have, or lengthens a run that already has one. `activities` are Garmin's runs for
 * the rules' history (check.ts).
 */
export function checkChange(
  changed: Plan,
  activities: Activity[],
  planned: string,
  distance_m: number,
  today: string,
  day = planned,
): ChangeResult {
  const run = runOn(changed, planned);
  if (!run) return { error: "There's no run planned on that day." };
  if (day < today) return { error: "That run is in the past." };
  if (!Number.isInteger(distance_m) || distance_m < MIN_M || distance_m > MAX_M) {
    return { error: `Pick a distance from ${km(MIN_M)} to ${km(MAX_M)} km, in whole metres.` };
  }
  const key = (f: { code: string; day: string }) => `${f.code} ${f.day}`;
  const before = new Set(checkPlan(changed, activities).filter((f) => f.severity === "error").map(key));
  const after = checkPlan(withChanges(changed, { [planned]: distance_m }), activities);
  const longer = distance_m > run.distance_m;
  const added = after.find((f) => f.severity === "error" && (!before.has(key(f)) || (longer && f.day === planned)));
  if (added) return { error: added.message };
  return { warnings: after.filter((f) => f.day === planned).map((f) => f.message) };
}

/**
 * plan.json with the saved changes but not the moves, and the Garmin runs before it: what the safety
 * rules check, since they look at the plan's own days (the Plan check page, Claude's check_plan).
 */
export function changedPlan(file = dbPath()): { plan: Plan; history: Activity[] } {
  const changed = withChanges(written, savedChanges(file));
  const { from, to } = historyRange(changed);
  return { plan: changed, history: activitiesBetween(from, to, file) };
}

/** Sets the run planned on `planned` (now on `day`) to `distance_m` if checkChange allows it, or with no distance puts it back to the plan's. */
export function tryChange(
  planned: string,
  distance_m: number | undefined,
  today: string,
  day = planned,
  file = dbPath(),
): ChangeResult {
  if (distance_m === undefined) {
    saveChange(planned, undefined, file);
    return { warnings: [] };
  }
  const { plan, history } = changedPlan(file);
  const result = checkChange(plan, history, planned, distance_m, today, day);
  if (!("error" in result)) saveChange(planned, distance_m, file);
  return result;
}

/** Every saved change. A missing file or table means nothing has changed. */
export function savedChanges(file = dbPath()): Changes {
  return readTable(
    "changes",
    {},
    (db) => {
      const rows = db.prepare("SELECT planned_date, distance_m FROM changes").all() as { planned_date: string; distance_m: number }[];
      return Object.fromEntries(rows.map((r) => [r.planned_date, r.distance_m]));
    },
    file,
  );
}

/** Saves a change, or with no distance puts the run back to the plan's. Creates the file and table on first use. */
export function saveChange(planned: string, distance_m: number | undefined, file = dbPath()): void {
  writeTable(
    SCHEMA,
    (db) => {
      if (distance_m === undefined) {
        db.prepare("DELETE FROM changes WHERE planned_date = ?").run(planned);
      } else {
        db.prepare(
          `INSERT INTO changes (planned_date, distance_m, saved_at) VALUES (?, ?, ?)
           ON CONFLICT(planned_date) DO UPDATE SET distance_m = excluded.distance_m, saved_at = excluded.saved_at`,
        ).run(planned, distance_m, new Date().toISOString());
      }
    },
    file,
  );
}
