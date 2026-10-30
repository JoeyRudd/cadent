import type { Lap } from "@/lib/activities";
import { clock, km, pace } from "@/lib/format";
import type { LapKind, Split } from "@/lib/run";

/** Signed metres: 3 → "+3", -2 → "−2", 0 → "0". */
function climb(m: number | null): string {
  if (m === null) return "–";
  return m > 0 ? `+${m}` : m < 0 ? `−${-m}` : "0";
}

// Kilometre splits: pace with a bar (longer is faster), heart rate and climb. `target` is the plan's
// [fast, slow] pace; with one, each bar says whether the split was on it, in colour and in words.
export function Splits({ splits, target }: { splits: Split[]; target?: [number, number] }) {
  // Full kilometres set the scale; a short last split's pace is too rough to stretch it.
  const full = splits.filter((s) => s.distance_m >= 1000);
  const paces = (full.length > 0 ? full : splits).map((s) => s.pace_s_per_km);
  const [fastest, slowest] = [Math.min(...paces), Math.max(...paces)];

  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Kilometre splits</caption>
      <thead className="text-xs text-muted">
        <tr>
          <th scope="col" className="pb-2 text-left font-medium">Km</th>
          <th scope="col" className="pb-2 text-left font-medium">Pace</th>
          <th scope="col" className="pb-2">
            <span className="sr-only">Pace bar</span>
          </th>
          <th scope="col" className="pb-2 text-right font-medium">HR</th>
          <th scope="col" className="pb-2 pl-3 text-right font-medium">Climb</th>
        </tr>
      </thead>
      <tbody>
        {splits.map((split) => {
          // A third of the width for the slowest split, all of it for the fastest.
          const pace_s = Math.min(slowest, Math.max(fastest, split.pace_s_per_km));
          const width = slowest > fastest ? 33 + (67 * (slowest - pace_s)) / (slowest - fastest) : 100;
          const onTarget = target && split.pace_s_per_km >= target[0] && split.pace_s_per_km <= target[1];
          // A short last split is drawn quietly: its pace is too rough to compare.
          const partial = split.distance_m < 1000;
          const bar = partial ? "bg-line" : !target ? "bg-accent" : onTarget ? "bg-on-plan" : "bg-off-plan";
          return (
            <tr key={split.km} className="border-t border-line">
              <th scope="row" className="py-2 pr-2 text-left font-medium">
                {split.distance_m < 1000 ? km(split.distance_m) : split.km}
              </th>
              <td className={`py-2 pr-3 ${partial ? "text-muted" : "font-semibold"}`}>{pace(split.pace_s_per_km)}</td>
              <td className="w-full py-2 pr-3">
                <div className={`h-2 rounded-full ${bar}`} style={{ width: `${width}%` }} />
                {target && !partial && <span className="sr-only">{onTarget ? "On target" : "Off target"}</span>}
              </td>
              <td className="py-2 text-right">{split.avg_hr ?? "–"}</td>
              <td className="py-2 pl-3 text-right text-muted">{climb(split.elev_change_m)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const LAP_NAMES: Record<LapKind, string> = {
  "warm-up": "Warm-up",
  rep: "Rep",
  recovery: "Recovery",
  "cool-down": "Cool-down",
};

// Garmin's laps as recorded. For a workout, `kinds` names each one: the reps are bold, and with the
// plan's rep `target` each says whether it was on pace; warm-up, recoveries and cool-down stay quiet.
export function Laps({ laps, kinds, target }: { laps: Lap[]; kinds?: LapKind[]; target?: [number, number] }) {
  let rep = 0;
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Laps</caption>
      <thead className="text-xs text-muted">
        <tr>
          <th scope="col" className="pb-2 text-left font-medium">Lap</th>
          <th scope="col" className="pb-2 text-right font-medium">Km</th>
          <th scope="col" className="pb-2 text-right font-medium">Time</th>
          <th scope="col" className="pb-2 text-right font-medium">Pace</th>
          <th scope="col" className="pb-2 text-right font-medium">HR</th>
        </tr>
      </thead>
      <tbody>
        {laps.map((lap, n) => {
          const kind = kinds?.[n];
          const lapPace = lap.distance_m > 0 ? Math.round(lap.duration_s / (lap.distance_m / 1000)) : undefined;
          const name = kind === "rep" ? `Rep ${++rep}` : kind ? LAP_NAMES[kind] : String(n + 1);
          const quiet = kind !== undefined && kind !== "rep";
          const onPace = kind === "rep" && target && lapPace !== undefined && lapPace >= target[0] && lapPace <= target[1];
          return (
            <tr key={n} className={`border-t border-line ${quiet ? "text-muted" : ""}`}>
              <th scope="row" className={`py-2 text-left ${quiet ? "font-normal" : "font-medium"}`}>
                {name}
              </th>
              <td className="py-2 text-right">{km(lap.distance_m)}</td>
              <td className="py-2 text-right">{clock(lap.duration_s)}</td>
              <td className={`py-2 text-right ${quiet ? "" : "font-bold"}`}>
                {lapPace !== undefined ? pace(lapPace) : "–"}
                {kind === "rep" && target && (
                  <span
                    className={`ml-1.5 rounded-full px-1.5 text-xs font-semibold ${
                      onPace ? "bg-on-plan-soft text-on-plan" : "bg-off-plan-soft text-off-plan"
                    }`}
                  >
                    {onPace ? "On" : lapPace! < target[0] ? "Fast" : "Slow"}
                  </span>
                )}
              </td>
              <td className="py-2 text-right">{lap.avg_hr ?? "–"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
