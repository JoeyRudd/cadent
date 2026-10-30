import { clock, zoneLabel } from "@/lib/format";
import type { ZoneBand } from "@/lib/run";

/**
 * "Zone 2 · 142–158", "Below Zone 1 · under 126", "Above Zone 4 · 189+". A gap the plan skipped a
 * number for, between z2 and z4, is "Zone 3 (not in plan)"; any other gap is "Between zones".
 */
function bandLabel(band: ZoneBand, bands: ZoneBand[]): { name: string; bpm: string } {
  if (band.zone) return { name: zoneLabel(band.zone), bpm: `${band.lo}–${band.hi}` };
  const zones = bands.filter((b) => b.zone);
  if (band.hi === Infinity) return { name: `Above ${zoneLabel(zones.at(-1)!.zone!)}`, bpm: `${band.lo}+` };
  if (band.lo === 0) return { name: `Below ${zoneLabel(zones[0].zone!)}`, bpm: `under ${band.hi}` };
  const [below, above] = [bands.find((b) => b.hi === band.lo), bands.find((b) => b.lo === band.hi)];
  const [n, m] = [below?.zone, above?.zone].map((z) => Number(z?.replace(/^z/, "")));
  const name = m - n === 2 ? `${zoneLabel(`z${n + 1}`)} (not in plan)` : "Between zones";
  return { name, bpm: `${band.lo}–${band.hi}` };
}

// Time in each heart rate band you spent time in, one row each; the rest are named on one quiet line.
// The planned zone is filled with the accent; the words and times carry the meaning, not the colour.
export function ZoneTime({ bands, planned }: { bands: ZoneBand[]; planned?: string }) {
  const total = bands.reduce((sum, b) => sum + b.seconds, 0);
  if (total === 0) return null;
  const rows = bands.filter((b) => b.seconds > 0);
  const unused = bands.filter((b) => b.zone && b.seconds === 0).map((b) => zoneLabel(b.zone!));

  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((band) => {
        const { name, bpm } = bandLabel(band, bands);
        const share = Math.round((band.seconds / total) * 100);
        const isPlanned = band.zone !== undefined && band.zone === planned;
        return (
          <li key={band.lo}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <p>
                <span className="font-medium">{name}</span> <span className="text-muted">{bpm}</span>
                {isPlanned && <span className="text-muted"> · planned</span>}
              </p>
              <p className="font-semibold">
                {clock(band.seconds)} <span className="font-normal text-muted">{share}%</span>
              </p>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
              <div className={`h-full rounded-full ${isPlanned ? "bg-accent" : "bg-muted"}`} style={{ width: `${share}%` }} />
            </div>
          </li>
        );
      })}
      {unused.length > 0 && <li className="text-xs text-muted">No time in {unused.join(" or ")}.</li>}
    </ul>
  );
}
