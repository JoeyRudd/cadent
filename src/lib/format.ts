// Display formatting. Everything else stays in metres and seconds.

import type { Block, Extra, Run, RunType } from "./plan";
import type { Week } from "./week";

const RUN_TYPE_LABELS: Record<RunType, string> = {
  easy: "Easy run",
  long: "Long run",
  tempo: "Tempo",
  intervals: "Intervals",
  recovery: "Recovery run",
  shakeout: "Shakeout",
  race: "Race",
};

export function runTypeLabel(type: RunType): string {
  return RUN_TYPE_LABELS[type];
}

/** 5000 → "5.0" (km, one decimal). */
export function km(metres: number): string {
  return (metres / 1000).toFixed(1);
}

/** 340 s/km → "5:40". */
export function pace(secondsPerKm: number): string {
  const seconds = String(secondsPerKm % 60).padStart(2, "0");
  return `${Math.floor(secondsPerKm / 60)}:${seconds}`;
}

/** A run's pace target: 405 → "~6:45 /km", [390, 420] → "6:30–7:00 /km". */
export function paceTarget(target: NonNullable<Run["pace_s_per_km"]>): string {
  if (typeof target === "number") return `~${pace(target)} /km`;
  return `${pace(target[0])}–${pace(target[1])} /km`;
}

/** { strides, reps [4, 6], 20 s } → "Strides 4–6 × 20 s"; without reps → "20 s strides". */
export function extraLabel(extra: Extra): string {
  if (!extra.reps) return `${duration(extra.duration_s)} ${extra.type}`;
  const reps = typeof extra.reps === "number" ? extra.reps : `${extra.reps[0]}–${extra.reps[1]}`;
  return `${extra.type.charAt(0).toUpperCase()}${extra.type.slice(1)} ${reps} × ${duration(extra.duration_s)}`;
}

/** 20 → "20 s", 300 → "5 min", 90 → "1 min 30 s". */
export function duration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = `${Math.floor(seconds / 60)} min`;
  return seconds % 60 === 0 ? minutes : `${minutes} ${seconds % 60} s`;
}

/** 26400 s → "7:20" (hours and minutes, for sleep). */
export function hoursMinutes(seconds: number): string {
  return pace(Math.round(seconds / 60));
}

/** 2480 → "41:20", 3725 → "1:02:05" (a run's time). */
export function clock(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const rest = pace(seconds % 3600);
  return hours > 0 ? `${hours}:${rest.padStart(5, "0")}` : rest;
}

/** "z2" → "Zone 2". */
export function zoneLabel(zone: string): string {
  return `Zone ${zone.replace(/^z/, "")}`;
}

// Plan dates parse as UTC midnight, so format them in UTC to keep the same calendar day.

/** "2026-10-27" → "Tuesday, Oct 27". */
export function dayLabel(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(day));
}

/** "2026-10-27" → "Tue, Oct 27". */
export function shortDayLabel(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(day));
}

/** "2026-10-28" → "Wed". */
export function weekday(day: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(day));
}

/** One workout block as a name and a detail line, e.g. "Sub-threshold" / "4 × 6 min @ 5:40–5:55 /km, 1 min rest". */
export function blockLabel(block: Block): { name: string; detail: string } {
  let amount = "";
  if (block.distance_m !== undefined) amount = `${km(block.distance_m)} km`;
  else if (block.duration_s !== undefined) amount = duration(block.duration_s);

  const parts: string[] = [];
  if (block.reps) parts.push(amount ? `${block.reps} × ${amount}` : `× ${block.reps}`);
  else if (amount) parts.push(amount);
  if (block.pace_s_per_km) parts.push(`@ ${paceTarget(block.pace_s_per_km)}`);
  if (block.hr_ceiling) parts.push(`under ${block.hr_ceiling} bpm`);

  let detail = parts.join(" ");
  if (block.recovery_s) detail += `, ${duration(block.recovery_s)} rest`;
  return { name: block.label.charAt(0).toUpperCase() + block.label.slice(1), detail };
}

const SHORT_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

/** "2026-10-26" → "Oct 26". */
export function shortDate(day: string): string {
  return SHORT_DATE.format(new Date(day));
}

/** "2026-11-02" → "Nov". */
export function monthShort(day: string): string {
  return MONTH.format(new Date(day));
}

/** A run's time and pace on one line: "41:12 · 5:48 /km". */
export function timeAndPace(duration_s: number, pace_s_per_km: number | null): string {
  return pace_s_per_km === null ? clock(duration_s) : `${clock(duration_s)} · ${pace(pace_s_per_km)} /km`;
}

/** "2026-10-28" → "28". */
export function dayOfMonth(day: string): string {
  return String(Number(day.slice(8, 10)));
}

/** Where a week stands against the plan, in a few gentle words. */
export function weekProgress(
  week: Pick<Week, "start" | "end" | "planned_m" | "actual_m" | "runs_planned">,
  today: string,
): string {
  const toGo = week.planned_m - week.actual_m;
  if (week.start > today) return `Starts ${shortDayLabel(week.start)}`;
  if (toGo <= 0) return "Week's distance done";
  if (week.end < today) return `${km(toGo)} km under plan, that's fine`;
  return `${km(toGo)} km to go`;
}

/** How far a week is from this one: "This week", "Last week", "3 weeks ago", "Next week", "In 3 weeks". Both are Mondays. */
export function weeksAway(start: string, thisWeek: string): string {
  const weeks = Math.round((new Date(start).getTime() - new Date(thisWeek).getTime()) / (7 * 24 * 3600 * 1000));
  if (weeks === 0) return "This week";
  if (weeks === -1) return "Last week";
  if (weeks === 1) return "Next week";
  return weeks < 0 ? `${-weeks} weeks ago` : `In ${weeks} weeks`;
}
