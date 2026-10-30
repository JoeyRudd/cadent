// One day's planned run next to what Garmin recorded, for the run detail screen.
// Pure: the page passes in the plan and that day's activities.

import type { Activity, Details, Lap, Point } from "./activities";
import { sessionsOn, type Plan, type Run, type RunType } from "./plan";
import { dayStatus, isRun, paceOf, TOLERANCE, weekBounds, type DayStatus } from "./week";

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
  /** Average pace against the plan's target; only when both exist. */
  pace?: "fast" | "on" | "slow";
};

/** A pace target as [fast, slow]: a range as written, or a single "~" target widened by the tolerance. */
export function paceRange(target: NonNullable<Run["pace_s_per_km"]>): [number, number] {
  if (typeof target === "number") return [target * (1 - TOLERANCE), target * (1 + TOLERANCE)];
  // Sorted, so a range written [slow, fast] still reads the right way round.
  return [Math.min(...target), Math.max(...target)];
}

/** Inside the target's [fast, slow] range. */
function versusPace(target: NonNullable<Run["pace_s_per_km"]>, actual: number): RunDetail["pace"] {
  const [fast, slow] = paceRange(target);
  if (actual < fast) return "fast";
  if (actual > slow) return "slow";
  return "on";
}

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
    pace_s_per_km: paceOf(distance_m, duration_s),
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

  const pace =
    run?.pace_s_per_km !== undefined && recorded?.pace_s_per_km != null
      ? versusPace(run.pace_s_per_km, recorded.pace_s_per_km)
      : undefined;

  return {
    run,
    planned_m,
    recorded,
    status: dayStatus(planned_m, recorded?.distance_m ?? 0, date, today),
    zone,
    hr,
    pace,
  };
}

/** `status` is undefined for a day before the plan, which has nothing to compare with. */
export type RecentRun = { date: string; type?: RunType; recorded: Recorded; status?: DayStatus };

/** The days with a recorded run, newest first, each the way run detail sees it (all that day's runs as one). */
export function recentRuns(plan: Plan, activities: Activity[], today: string, limit = 5): RecentRun[] {
  const dates = [...new Set(activities.filter(isRun).map((a) => a.date))].sort().reverse().slice(0, limit);
  return dates.flatMap((date) => {
    const { run, recorded, status } = runDetail(plan, activities, date, today);
    return recorded ? [{ date, type: run?.type, recorded, status: weekBounds(plan, date) ? status : undefined }] : [];
  });
}

/** Every run that day as one: each run's samples carry on from where the one before ended. */
export function joinDetails(runs: Details[]): Details {
  const points: Point[] = [];
  for (const run of runs) {
    const last = points.at(-1);
    const [t0, d0] = last ? [last.t_s, last.distance_m] : [0, 0];
    points.push(...run.points.map((p) => ({ ...p, t_s: p.t_s + t0, distance_m: p.distance_m + d0 })));
  }
  return { laps: runs.flatMap((run) => run.laps), points };
}

export type Split = {
  /** 1-based; the last split can be part of a kilometre. */
  km: number;
  distance_m: number;
  /** Moving time, so a stop at a light doesn't slow the split. */
  duration_s: number;
  pace_s_per_km: number;
  avg_hr: number | null;
  elev_change_m: number | null;
};

// Slower than this between two samples counts as stopped.
const MOVING_M_S = 0.5;

/** Kilometre splits from the samples. Time and heart rate between two samples are shared out by distance. */
export function kmSplits(points: Point[]): Split[] {
  const splits: Split[] = [];
  const fresh = (elevStart: number | null) => ({ distance_m: 0, duration_s: 0, hrTime: 0, hrSum: 0, elevStart, elevEnd: elevStart });
  let open = fresh(points[0]?.elev_m ?? null);

  const close = (elevEnd: number | null) => {
    const { distance_m, duration_s, hrTime, hrSum, elevStart } = open;
    splits.push({
      km: splits.length + 1,
      distance_m: Math.round(distance_m),
      duration_s: Math.round(duration_s),
      pace_s_per_km: Math.round(duration_s / (distance_m / 1000)),
      avg_hr: hrTime > 0 ? Math.round(hrSum / hrTime) : null,
      elev_change_m: elevStart !== null && elevEnd !== null ? Math.round(elevEnd - elevStart) : null,
    });
    open = fresh(elevEnd);
  };

  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]];
    let left = b.distance_m - a.distance_m;
    const dt = b.t_s - a.t_s;
    if (left <= 0 || dt <= 0) continue;
    const moving = left / dt >= MOVING_M_S;
    const total = left;
    while (left > 0) {
      const take = Math.min(left, 1000 - open.distance_m);
      const share = (moving ? dt : 0) * (take / total);
      open.distance_m += take;
      open.duration_s += share;
      if (b.hr !== null) {
        open.hrTime += share;
        open.hrSum += b.hr * share;
      }
      left -= take;
      if (open.distance_m >= 1000) close(lerp(a.elev_m, b.elev_m, 1 - left / total));
    }
    open.elevEnd = b.elev_m ?? open.elevEnd;
  }
  // A last bit under 50 m is GPS noise, not a split.
  if (open.distance_m >= 50 && open.duration_s > 0) close(open.elevEnd);
  return splits;
}

function lerp(a: number | null, b: number | null, f: number): number | null {
  return a !== null && b !== null ? a + (b - a) * f : (b ?? a);
}

export type ZoneBand = {
  /** The plan's zone name; undefined for the bpm between or beyond the plan's zones. */
  zone?: string;
  lo: number;
  hi: number;
  seconds: number;
};

/**
 * Seconds of heart rate in each band, lowest first: the plan's zones plus whatever lies below, between
 * and above them, so every second with a heart rate is counted once. A band's top bpm belongs to the band above.
 */
export function zoneTime(points: Point[], zones: Plan["zones"]): ZoneBand[] {
  const bands: ZoneBand[] = [];
  let edge = 0;
  for (const [zone, [lo, hi]] of Object.entries(zones).sort(([, a], [, b]) => a[0] - b[0])) {
    if (lo > edge) bands.push({ lo: edge, hi: lo, seconds: 0 });
    bands.push({ zone, lo, hi, seconds: 0 });
    edge = hi;
  }
  bands.push({ lo: edge, hi: Infinity, seconds: 0 });

  for (let i = 1; i < points.length; i++) {
    const { hr } = points[i];
    const band = hr !== null && bands.find((b) => hr >= b.lo && hr < b.hi);
    if (band) band.seconds += points[i].t_s - points[i - 1].t_s;
  }
  return bands;
}

// Samples either side of each point that its pace is taken across.
const PACE_WINDOW = 5;

/**
 * Pace along the run as [distance_m, s/km], from the distance and time across eleven samples (about a
 * minute) so GPS jitter doesn't spike it. Null where you were stopped, which the chart draws as a gap.
 */
export function paceSeries(points: Point[]): [number, number | null][] {
  return points.map((p, i) => {
    const [a, b] = [points[Math.max(0, i - PACE_WINDOW)], points[Math.min(points.length - 1, i + PACE_WINDOW)]];
    const speed = b.t_s > a.t_s ? (b.distance_m - a.distance_m) / (b.t_s - a.t_s) : 0;
    return [p.distance_m, speed >= MOVING_M_S ? Math.round(1000 / speed) : null];
  });
}

/** Max heart rate, total climb and average cadence, each undefined when Garmin didn't record it. */
export function runStats({ laps, points }: Details): { max_hr?: number; climb_m?: number; cadence_spm?: number } {
  const hrs = [...points.map((p) => p.hr), ...laps.map((l) => l.max_hr)].filter((hr) => hr !== null);
  const climbs = laps.map((l) => l.elev_gain_m).filter((m) => m !== null);
  const paced = laps.filter((l): l is Lap & { cadence_spm: number } => l.cadence_spm !== null && l.duration_s > 0);
  const pacedTime = paced.reduce((sum, l) => sum + l.duration_s, 0);
  return {
    max_hr: hrs.length > 0 ? Math.max(...hrs) : undefined,
    climb_m: climbs.length > 0 ? climbs.reduce((sum, m) => sum + m, 0) : undefined,
    cadence_spm:
      pacedTime > 0 ? Math.round(paced.reduce((sum, l) => sum + l.cadence_spm * l.duration_s, 0) / pacedTime) : undefined,
  };
}

const WORKOUT_SPREAD_S = 30;

export type LapKind = "warm-up" | "rep" | "recovery" | "cool-down";

/**
 * What each lap of a structured workout was, guessed from pace: Garmin's laps don't say. The first and
 * last are the warm-up and cool-down; between them, a lap nearer the fastest than the slowest is a rep.
 * Undefined when the laps don't look like a workout (fewer than four, or all about the same pace).
 */
export function lapKinds(laps: Lap[]): LapKind[] | undefined {
  if (laps.length < 4 || laps.some((l) => l.distance_m <= 0)) return undefined;
  const paces = laps.map((l) => l.duration_s / (l.distance_m / 1000));
  const middle = paces.slice(1, -1);
  const [fast, slow] = [Math.min(...middle), Math.max(...middle)];
  // Reps and recoveries at least this far apart; less is just a steady run with auto-lap on.
  if (slow - fast < WORKOUT_SPREAD_S) return undefined;
  return paces.map((p, n) =>
    n === 0 ? "warm-up" : n === paces.length - 1 ? "cool-down" : p < (fast + slow) / 2 ? "rep" : "recovery",
  );
}
