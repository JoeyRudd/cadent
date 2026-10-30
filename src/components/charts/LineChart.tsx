"use client";

import { useState } from "react";

import { km, pace } from "@/lib/format";

// Drawing space; the SVG scales to the card's width.
const W = 320;
const H = 172;
const LEFT = 34;
const BOTTOM = 18;
const TOP = 10;
const RIGHT = 8;

// One step of the arrow keys along the run.
const KEY_STEP_M = 100;

const FORMAT = {
  // Ticks every 15 s of pace or 10 bpm, doubled until there are at most four.
  pace: { value: (v: number) => pace(v), unit: "/km", step: 15 },
  hr: { value: (v: number) => String(v), unit: "bpm", step: 10 },
};

/** Round values inside [lo, hi]: 5:15, 6:00, 6:45 rather than 5:14, 6:09, 7:03. */
function niceTicks(lo: number, hi: number, step: number): number[] {
  while ((hi - lo) / step > 3) step *= 2;
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  return ticks;
}

/**
 * A value along the run's distance: pace (faster at the top) or heart rate. Drag a finger, hover a
 * mouse, or use the arrow keys (Home/End for the ends, Escape for the average) to read any point.
 * `band` shades the plan's target; `profile` draws the elevation underneath, quietly, on the same
 * distance axis.
 */
export function LineChart({
  kind,
  label,
  average,
  series,
  domain,
  band,
  profile,
}: {
  kind: "pace" | "hr";
  /** What the chart shows, in words, for screen readers. */
  label: string;
  /** The run's average, shown above the chart until you pick a point. */
  average: number;
  series: [number, number | null][];
  domain: [number, number];
  band?: [number, number];
  profile?: [number, number][];
}) {
  const [at, setAt] = useState<number>();
  const format = FORMAT[kind];
  const distance = series.at(-1)?.[0] ?? 0;
  const [lo, hi] = domain;

  const x = (d: number) => LEFT + (d / distance) * (W - LEFT - RIGHT);
  // Pace is drawn faster-up, so a smaller number sits higher.
  const y = (v: number) => {
    const f = (v - lo) / (hi - lo);
    return TOP + (kind === "pace" ? f : 1 - f) * (H - TOP - BOTTOM);
  };
  const clampY = (v: number) => y(Math.min(hi, Math.max(lo, v)));

  let line = "";
  let pen = false;
  for (const [d, v] of series) {
    if (v === null) {
      pen = false;
      continue;
    }
    line += `${pen ? "L" : "M"}${x(d).toFixed(1)} ${clampY(v).toFixed(1)}`;
    pen = true;
  }

  const ticks = niceTicks(lo, hi, format.step);
  const kmTicks = Array.from({ length: Math.floor(distance / 1000) }, (_, n) => (n + 1) * 1000).filter(
    // Fewer labels on a long run so they don't collide.
    (d) => distance < 12000 || d % 2000 === 0,
  );

  const sample = at === undefined ? undefined : nearest(series, at);

  function pick(clientX: number, box: DOMRect) {
    const f = ((clientX - box.left) / box.width) * W;
    setAt(Math.min(distance, Math.max(0, ((f - LEFT) / (W - LEFT - RIGHT)) * distance)));
  }

  return (
    <div>
      <p className="text-sm text-muted" aria-live="polite">
        {sample?.[1] != null ? `At ${km(sample[0])} km` : "Average"}{" "}
        <span className="text-lg font-bold text-ink">{format.value(sample?.[1] ?? average)}</span> {format.unit}
      </p>
      <svg
        role="img"
        aria-label={`${label} Use the arrow keys, Home and End, or drag to read a point.`}
        tabIndex={0}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 w-full cursor-crosshair touch-pan-y select-none rounded-button outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
        onPointerDown={(e) => {
          // Keep the drag while the finger strays off the chart.
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e.clientX, e.currentTarget.getBoundingClientRect());
        }}
        onPointerMove={(e) => {
          // A mouse reads on hover; a finger or pen only while pressed.
          if (e.pointerType === "mouse" || e.buttons > 0) pick(e.clientX, e.currentTarget.getBoundingClientRect());
        }}
        // A finger's last point stays after lifting; a mouse leaving returns to the average.
        onPointerLeave={(e) => e.pointerType === "mouse" && setAt(undefined)}
        onKeyDown={(e) => {
          if (e.key === "Escape") return setAt(undefined);
          const next = {
            ArrowRight: (d = 0) => d + KEY_STEP_M,
            ArrowLeft: (d = 0) => d - KEY_STEP_M,
            Home: () => 0,
            End: () => distance,
          }[e.key];
          if (next === undefined) return;
          e.preventDefault();
          setAt((d) => Math.min(distance, Math.max(0, next(d))));
        }}
      >
        {band && (
          <g>
            <rect
              className="fill-accent-soft"
              x={LEFT}
              width={W - LEFT - RIGHT}
              y={Math.min(clampY(band[0]), clampY(band[1]))}
              height={Math.abs(clampY(band[1]) - clampY(band[0]))}
            />
            {/* The soft fill is close to the card in both themes; the dashed edges carry the band. */}
            {band.map((v) => (
              <line
                key={v}
                className="stroke-accent"
                x1={LEFT}
                x2={W - RIGHT}
                y1={clampY(v)}
                y2={clampY(v)}
                strokeDasharray="4 3"
              />
            ))}
          </g>
        )}
        {profile && profile.length > 1 && <Profile profile={profile} x={x} />}

        {ticks.map((v) => (
          <g key={v}>
            <line className="stroke-line" x1={LEFT} x2={W - RIGHT} y1={y(v)} y2={y(v)} />
            <text className="fill-muted text-xs" x={LEFT - 6} y={y(v) + 4} textAnchor="end">
              {format.value(v)}
            </text>
          </g>
        ))}
        <text className="fill-muted text-xs" x={LEFT - 6} y={H - 2} textAnchor="end">
          km
        </text>
        {kmTicks.map((d) => (
          <text key={d} className="fill-muted text-xs" x={x(d)} y={H - 2} textAnchor="middle">
            {d / 1000}
          </text>
        ))}

        <path d={line} className="fill-none stroke-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {sample?.[1] != null && (
          <g>
            <line className="stroke-ink" x1={x(sample[0])} x2={x(sample[0])} y1={TOP} y2={H - BOTTOM} />
            <circle className="fill-accent stroke-surface" cx={x(sample[0])} cy={clampY(sample[1])} r={4} strokeWidth={2} />
          </g>
        )}
      </svg>
    </div>
  );
}

/** Elevation as a quiet filled shape along the bottom third of the chart. */
function Profile({ profile, x }: { profile: [number, number][]; x: (d: number) => number }) {
  const elevations = profile.map(([, e]) => e);
  const [min, max] = [Math.min(...elevations), Math.max(...elevations)];
  const base = H - BOTTOM;
  const height = (H - TOP - BOTTOM) / 3;
  const y = (e: number) => base - (max > min ? ((e - min) / (max - min)) * height : 0);
  const top = profile.map(([d, e]) => `L${x(d).toFixed(1)} ${y(e).toFixed(1)}`).join("");
  return <path className="fill-line" d={`M${x(profile[0][0])} ${base}${top}L${x(profile[profile.length - 1][0])} ${base}Z`} />;
}

/** The sample closest to `distance` that has a value. */
function nearest(series: [number, number | null][], distance: number): [number, number | null] | undefined {
  let best: [number, number | null] | undefined;
  for (const sample of series) {
    if (sample[1] === null) continue;
    if (!best || Math.abs(sample[0] - distance) < Math.abs(best[0] - distance)) best = sample;
  }
  return best;
}
