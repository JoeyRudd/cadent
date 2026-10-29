// Display formatting. Everything else stays in metres and seconds.

import type { Block, Extra, Run, RunType } from "./plan";

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
