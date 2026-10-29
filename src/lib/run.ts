// One day's planned run next to what Garmin recorded, for the run detail screen.
// Pure: the page passes in the plan and that day's activities.

import type { Activity } from "./activities";
import { sessionsOn, type Plan, type Run } from "./plan";
import { dayStatus, isRun, type DayStatus } from "./week";

export type Recorded = {
  distance_m: number;
  duration_s: number;
  pace_s_per_km: number | null;
  avg_hr: number | null;
};

export type RunDetail = {
  /** The day's first planned run, for its type and zone. */
  run?: Run;
  /** Every planned run that day, as the week view counts it. */
  planned_m: number;
  recorded?: Recorded;
  /** The same status the week view gives the day. */
  status: DayStatus;
  /** The planned zone's heart rate range, if the run has one. */
  zone?: [number, number];
  /** Average heart rate against the zone; only when both exist. */
  hr?: "below" | "in" | "above";
};

/** Every run Garmin recorded that day as one: summed distance and time, heart rate averaged over time. */
function combine(runs: Activity[]): Recorded | undefined {
  if (runs.length === 0) return undefined;
  const distance_m = runs.reduce((sum, a) => sum + a.distance_m, 0);
  const duration_s = runs.reduce((sum, a) => sum + a.duration_s, 0);
  const withHr = runs.filter((a): a is Activity & { avg_hr: number } => a.avg_hr !== null);
  const hrTime = withHr.reduce((sum, a) => sum + a.duration_s, 0);
  return {
    distance_m,
    duration_s,
    pace_s_per_km: distance_m > 0 ? Math.round(duration_s / (distance_m / 1000)) : null,
    avg_hr: hrTime > 0 ? Math.round(withHr.reduce((sum, a) => sum + a.avg_hr * a.duration_s, 0) / hrTime) : null,
  };
}

export function runDetail(plan: Plan, activities: Activity[], date: string, today: string): RunDetail {
  const runs = sessionsOn(plan, date).filter((s): s is Run => s.kind === "run");
  const run = runs[0];
  const planned_m = runs.reduce((sum, r) => sum + r.distance_m, 0);
  const recorded = combine(activities.filter((a) => a.date === date && isRun(a)));
  const zone = run?.zone ? plan.zones[run.zone] : undefined;

  let hr: RunDetail["hr"];
  if (zone && recorded?.avg_hr != null) {
    if (recorded.avg_hr < zone[0]) hr = "below";
    else if (recorded.avg_hr > zone[1]) hr = "above";
    else hr = "in";
  }

  return {
    run,
    planned_m,
    recorded,
    status: dayStatus(planned_m, recorded?.distance_m ?? 0, date, today),
    zone,
    hr,
  };
}
