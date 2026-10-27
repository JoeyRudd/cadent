// Plan-safety rules, ported from cadent-v1 (core/src/cadent_core/rules). Every rule looks at the
// planned runs plus the completed runs before them, and reports findings on planned days.

import { km } from "./format";
import type { Run } from "./plan";

export type Finding = {
  code: string;
  severity: "warning" | "error";
  day: string;
  message: string;
};

type Rule = (plan: Run[], history: Run[]) => Finding[];

export const LONG_RUN_SPIKE = "LONG_RUN_SPIKE";
export const MAX_RATIO = 1.1;
export const WINDOW_DAYS = 30;

export const MIN_RUN = "MIN_RUN";
const MIN_DISTANCE_M = 5000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `a` to `b` ("YYYY-MM-DD" strings, parsed as UTC midnight). */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
}

/** LONG_RUN_SPIKE: a long run may be at most 110% of the longest run in the previous 30 days. */
function longRunSpike(plan: Run[], history: Run[]): Finding[] {
  const everyRun = [...history, ...plan];
  return plan
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
function minRun(plan: Run[]): Finding[] {
  return plan
    .filter((r) => r.type !== "shakeout" && r.distance_m < MIN_DISTANCE_M)
    .map((r) => ({
      code: MIN_RUN,
      severity: "warning",
      day: r.date,
      message: `Run of ${km(r.distance_m)} km is under the 5 km minimum.`,
    }));
}

const RULES: Rule[] = [longRunSpike, minRun];

/** Run every rule over a plan, given completed runs before it. Findings sorted by day, then code. */
export function validate(plan: Run[], history: Run[]): Finding[] {
  const findings = RULES.flatMap((rule) => rule(plan, history));
  return findings.sort((a, b) => compare(a.day, b.day) || compare(a.code, b.code));
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
