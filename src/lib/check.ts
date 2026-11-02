// The plan check: every planned session against the safety rules, with Garmin runs from before the
// plan as history, so the first weeks' long runs are compared with what was actually run.

import type { Activity } from "./activities";
import { allSessions, type Plan } from "./plan";
import { validate, WINDOW_DAYS, type Finding } from "./rules";
import { addDays, isRun } from "./week";

/** The days of Garmin history the rules look at: the WINDOW_DAYS before the plan starts. */
export function historyRange(plan: Plan): { from: string; to: string } {
  const start = plan.weeks[0].start;
  return { from: addDays(start, -WINDOW_DAYS), to: addDays(start, -1) };
}

/** Findings for the whole plan. `activities` may be any Garmin activities; only runs in historyRange count. */
export function checkPlan(plan: Plan, activities: Activity[]): Finding[] {
  const { from, to } = historyRange(plan);
  return validate(allSessions(plan), activities.filter((a) => isRun(a) && a.date >= from && a.date <= to));
}
