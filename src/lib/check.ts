// The plan check: every planned run against the safety rules, with Garmin runs from before the
// plan as history, so the first weeks' long runs are compared with what was actually run.

import type { Activity } from "./activities";
import type { Plan, Run } from "./plan";
import { validate, WINDOW_DAYS, type Finding } from "./rules";
import { addDays, isRun } from "./week";

/** The days of Garmin history the rules look at: the WINDOW_DAYS before the plan starts. */
export function historyRange(plan: Plan): { from: string; to: string } {
  const start = plan.weeks[0].start;
  return { from: addDays(start, -WINDOW_DAYS), to: addDays(start, -1) };
}

/** Findings for the whole plan. `activities` may be any Garmin activities; only runs in historyRange count. */
export function checkPlan(plan: Plan, activities: Activity[]): Finding[] {
  const runs = plan.weeks.flatMap((week) => week.sessions).filter((s): s is Run => s.kind === "run");
  const { from, to } = historyRange(plan);
  const history = activities
    .filter((a) => isRun(a) && a.date >= from && a.date <= to)
    // The rules only read date and distance from history; "easy" stands in for Garmin's type.
    .map((a): Run => ({ date: a.date, kind: "run", type: "easy", distance_m: a.distance_m }));
  return validate(runs, history);
}
