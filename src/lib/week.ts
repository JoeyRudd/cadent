// One plan week (Monday to Sunday) with each day's planned runs next to what was recorded.
// Pure: the page passes in the plan, the activities and today's date.

import type { Activity } from "./activities";
import { isDay, type Lift, type Plan, type Run } from "./plan";

/** Within ±10% of the plan counts as on plan. */
export const TOLERANCE = 0.1;

export type DayStatus = "done" | "short" | "over" | "missed" | "upcoming" | "rest" | "extra";

export type WeekDay = {
  date: string;
  runs: Run[];
  lifts: Lift[];
  planned_m: number;
  actual_m: number;
  status: DayStatus;
};

export type Week = {
  index: number;
  start: string;
  end: string;
  days: WeekDay[];
  planned_m: number;
  actual_m: number;
};

/** "2026-10-26" + 6 → "2026-11-01". */
export function addDays(day: string, n: number): string {
  const date = new Date(day);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

/** Garmin types: "running", "treadmill_running", "trail_running", … */
export function isRun(activity: Activity): boolean {
  return activity.type.includes("running");
}

export function dayStatus(planned_m: number, actual_m: number, date: string, today: string): DayStatus {
  if (planned_m === 0) return actual_m > 0 ? "extra" : "rest";
  if (actual_m === 0) return date < today ? "missed" : "upcoming";
  // Today isn't over, so a partial distance isn't short yet.
  if (actual_m < planned_m * (1 - TOLERANCE)) return date < today ? "short" : "upcoming";
  if (actual_m > planned_m * (1 + TOLERANCE)) return "over";
  return "done";
}

function planWeek(plan: Plan, day: string) {
  return plan.weeks.find((w) => w.start <= day && day <= addDays(w.start, 6));
}

/** Monday to Sunday of the plan week containing `day`, or undefined outside the plan. */
export function weekBounds(plan: Plan, day: string): { start: string; end: string } | undefined {
  const week = planWeek(plan, day);
  return week && { start: week.start, end: addDays(week.start, 6) };
}

/** The plan week containing `day` (today by default), compared with `activities`, or undefined outside the plan. */
export function weekOf(plan: Plan, activities: Activity[], today: string, day = today): Week | undefined {
  const week = planWeek(plan, day);
  if (!week) return undefined;

  const days = Array.from({ length: 7 }, (_, i): WeekDay => {
    const date = addDays(week.start, i);
    const runs = week.sessions.filter((s): s is Run => s.kind === "run" && s.date === date);
    const lifts = week.sessions.filter((s): s is Lift => s.kind === "lift" && s.date === date);
    const planned_m = runs.reduce((sum, run) => sum + run.distance_m, 0);
    const actual_m = activities
      .filter((a) => a.date === date && isRun(a))
      .reduce((sum, a) => sum + a.distance_m, 0);
    return { date, runs, lifts, planned_m, actual_m, status: dayStatus(planned_m, actual_m, date, today) };
  });

  return {
    index: week.index,
    start: week.start,
    end: addDays(week.start, 6),
    days,
    planned_m: days.reduce((sum, d) => sum + d.planned_m, 0),
    actual_m: days.reduce((sum, d) => sum + d.actual_m, 0),
  };
}

/** The Monday of the calendar week containing `day`, inside the plan or not. */
export function mondayOf(day: string): string {
  return addDays(day, -((new Date(day).getUTCDay() + 6) % 7));
}

/** The day a `?start=` search param asks for, or undefined when it's missing or not a real day. */
export function dayParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && isDay(value) ? value : undefined;
}

/** The starts of the plan weeks just before and after the week starting `start`, which may be outside the plan. */
export function neighbourWeeks(plan: Plan, start: string): { prev?: string; next?: string } {
  const starts = plan.weeks.map((w) => w.start).sort();
  return { prev: starts.findLast((s) => s < start), next: starts.find((s) => s > start) };
}

/** Every plan week's planned distance, for the strip of weeks across the plan. */
export function planTotals(plan: Plan): { index: number; start: string; planned_m: number }[] {
  return plan.weeks.map((w) => ({
    index: w.index,
    start: w.start,
    planned_m: w.sessions.reduce((sum, s) => sum + (s.kind === "run" ? s.distance_m : 0), 0),
  }));
}
