import Link from "next/link";

import { blockLabel, extraLabel, km, paceTarget, runTypeLabel, zoneLabel } from "@/lib/format";
import type { Plan, Run } from "@/lib/plan";

// Today's run as the hero card: the distance is the number that matters.
export function RunCard({ run, zones, week }: { run: Run; zones: Plan["zones"]; week?: number }) {
  const range = run.zone ? zones[run.zone] : undefined;
  const pills = [
    run.zone && `${zoneLabel(run.zone)}${range ? ` · ${range[0]}–${range[1]} bpm` : ""}`,
    run.pace_s_per_km !== undefined && paceTarget(run.pace_s_per_km),
    ...(run.extras ?? []).map((extra) => `+ ${extraLabel(extra)}`),
  ].filter((pill): pill is string => !!pill);

  return (
    <section className="flex flex-col gap-3.5 rounded-card bg-accent-soft p-5.5 text-accent-ink">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-wider">Today · {runTypeLabel(run.type)}</p>
        {week !== undefined && (
          <p className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold">Week {week}</p>
        )}
      </div>

      <p className="flex items-baseline gap-2 text-ink">
        <span className="text-7xl font-bold leading-none tracking-tight">{km(run.distance_m)}</span>
        <span className="text-2xl font-semibold">km</span>
      </p>

      {pills.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {pills.map((pill, i) => (
            <li key={i} className="rounded-full bg-surface px-2.5 py-1.5 text-sm text-ink">
              {pill}
            </li>
          ))}
        </ul>
      )}

      {run.blocks && (
        <ol className="space-y-3 border-t border-accent-ink/20 pt-4">
          {run.blocks.map((block, i) => {
            const { name, detail } = blockLabel(block);
            return (
              <li key={i} className="text-sm">
                <p className="font-medium">{name}</p>
                {detail && <p className="opacity-80">{detail}</p>}
              </li>
            );
          })}
        </ol>
      )}

      <Link
        href="/week"
        className="flex h-12 items-center justify-center rounded-button bg-accent text-base font-semibold text-on-accent"
      >
        See session details
      </Link>
    </section>
  );
}
