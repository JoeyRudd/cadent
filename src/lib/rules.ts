// Plan-safety rules, ported from cadent-v1 (core/src/cadent_core/rules). Every rule looks at the
// planned sessions plus the completed runs before them, and reports findings on planned days.

import { km } from "./format";
import type { Run, Session } from "./plan";
import { addDays } from "./week";

export type Finding = {
  code: string;
  severity: "warning" | "error";
  day: string;
  message: string;
};

/** A completed run: all the history the rules need, so a Garmin activity fits as it is. */
type Ran = Pick<Run, "date" | "distance_m">;

type Rule = (plan: Session[], history: Ran[]) => Finding[];

export const LONG_RUN_SPIKE = "LONG_RUN_SPIKE";
export const MAX_RATIO = 1.1;
export const WINDOW_DAYS = 30;

export const MIN_RUN = "MIN_RUN";
const MIN_DISTANCE_M = 5000;

export const REST_DAY = "REST_DAY";
export const LONG_AFTER_FULL_BODY = "LONG_AFTER_FULL_BODY";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `a` to `b` ("YYYY-MM-DD" strings, parsed as UTC midnight). */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
}

/** The Monday on or before `day` (getUTCDay counts from Sunday = 0). */
function mondayOf(day: string): string {
  return addDays(day, -((new Date(day).getUTCDay() + 6) % 7));
}

const runsOf = (sessions: Session[]) => sessions.filter((s): s is Run => s.kind === "run");

/** LONG_RUN_SPIKE: a long run may be at most 110% of the longest run in the previous 30 days. */
function longRunSpike(plan: Session[], history: Ran[]): Finding[] {
  const runs = runsOf(plan);
  const everyRun = [...history, ...runs];
  return runs
    .filter((r) => r.type === "long")
    .flatMap((longRun): Finding[] => {
      const baseline = everyRun
        .filter((r) => {
          const gap = daysBetween(r.date, longRun.date);
          return gap > 0 && gap <= WINDOW_DAYS;
        })
        .map((r) => r.distance_m);
      if (baseline.length === 0) {
        return [
          {
            code: LONG_RUN_SPIKE,
            severity: "warning",
            day: longRun.date,
            message: "No runs in the previous 30 days to compare this long run against.",
          },
        ];
      }
      const limit = Math.max(...baseline) * MAX_RATIO;
      if (longRun.distance_m <= limit) return [];
      return [
        {
          code: LONG_RUN_SPIKE,
          severity: "error",
          day: longRun.date,
          message:
            `Long run of ${km(longRun.distance_m)} km is over the ` +
            `${km(limit)} km limit (110% of the longest run in 30 days).`,
        },
      ];
    });
}

/** MIN_RUN: no run under 5 km, except a race-week shakeout. */
function minRun(plan: Session[]): Finding[] {
  return runsOf(plan)
    .filter((r) => r.type !== "shakeout" && r.distance_m < MIN_DISTANCE_M)
    .map((r) => ({
      code: MIN_RUN,
      severity: "warning",
      day: r.date,
      message: `Run of ${km(r.distance_m)} km is under the 5 km minimum.`,
    }));
}

/** REST_DAY: every Monday-to-Sunday week keeps one day with no run and no lift. Reported on the Monday. */
function restDay(plan: Session[]): Finding[] {
  const busy = new Set(plan.map((s) => s.date));
  const mondays = new Set([...busy].map(mondayOf));
  return [...mondays]
    .filter((monday) => Array.from({ length: 7 }, (_, i) => addDays(monday, i)).every((d) => busy.has(d)))
    .map((monday) => ({
      code: REST_DAY,
      severity: "warning",
      day: monday,
      message: "No full rest day this week. Keep one day free of running and lifting.",
    }));
}

/** LONG_AFTER_FULL_BODY: no full-body lift on the day before a long run. */
function longAfterFullBody(plan: Session[]): Finding[] {
  const fullBodyDays = new Set(plan.filter((s) => s.kind === "lift" && s.name.startsWith("Full-body")).map((s) => s.date));
  return runsOf(plan)
    .filter((r) => r.type === "long" && fullBodyDays.has(addDays(r.date, -1)))
    .map((r) => ({
      code: LONG_AFTER_FULL_BODY,
      severity: "warning",
      day: r.date,
      message: "The long run is the day after a full-body lift. The plan keeps those apart.",
    }));
}

const RULES: Rule[] = [longRunSpike, minRun, restDay, longAfterFullBody];

/** Run every rule over a plan's sessions, given completed runs before it. Findings sorted by day, then code. */
export function validate(plan: Session[], history: Ran[]): Finding[] {
  const findings = RULES.flatMap((rule) => rule(plan, history));
  return findings.sort((a, b) => compare(a.day, b.day) || compare(a.code, b.code));
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
