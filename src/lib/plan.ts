// The training plan (data/plan.json, schema cadent.plan/v1) and lookups by local date.
// Dates are "YYYY-MM-DD" strings, so they compare correctly as plain strings.

import planJson from "../../data/plan.json";

const TIME_ZONE = "America/Toronto";

export type RunType = "easy" | "long" | "tempo" | "intervals" | "recovery" | "shakeout" | "race";

export type Block = {
  label: string;
  reps?: number;
  distance_m?: number;
  duration_s?: number;
  pace_s_per_km?: [number, number];
  hr_ceiling?: number;
  recovery_s?: number;
  zone?: string;
};

export type Extra = { type: string; reps?: number | [number, number]; duration_s: number };

export type Run = {
  date: string;
  kind: "run";
  type: RunType;
  distance_m: number;
  zone?: string;
  /** Target pace: a single value (shown as "~6:45 /km") or a [fast, slow] range. */
  pace_s_per_km?: number | [number, number];
  extras?: Extra[];
  blocks?: Block[];
};

export type Lift = {
  date: string;
  kind: "lift";
  name: string;
  after_run?: boolean;
};

export type Session = Run | Lift;

export type Plan = {
  name: string;
  race: { date: string; distance_m: number; goal_time_s: number };
  zones: Record<string, [number, number]>;
  weeks: { index: number; start: string; cutback: boolean; sessions: Session[] }[];
};

export const plan = planJson as unknown as Plan;

/** The calendar date at `now` in Toronto, as "YYYY-MM-DD". */
export function localDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

/** A real calendar day as "YYYY-MM-DD": not "2026-13-45", and not "2026-02-30", which Date rolls over to March 2. */
export function isDay(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function allSessions(plan: Plan): Session[] {
  return plan.weeks.flatMap((week) => week.sessions);
}

export function sessionsOn(plan: Plan, day: string): Session[] {
  return allSessions(plan).filter((s) => s.date === day);
}

/** The first run after `day`, if the plan has one. */
export function nextRun(plan: Plan, day: string): Run | undefined {
  return allSessions(plan).find((s): s is Run => s.kind === "run" && s.date > day);
}
