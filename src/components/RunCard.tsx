import { blockLabel, duration, km, runTypeLabel, zoneLabel } from "@/lib/format";
import type { Plan, Run } from "@/lib/plan";

// Today's run as the hero card: the distance is the number that matters.
export function RunCard({ run, zones }: { run: Run; zones: Plan["zones"] }) {
  const range = run.zone ? zones[run.zone] : undefined;

  return (
    <section className="rounded-card bg-accent-soft p-6 text-accent-ink">
      <p className="text-sm font-medium uppercase tracking-wide">{runTypeLabel(run.type)}</p>
      <p className="mt-2 text-6xl font-semibold">
        {km(run.distance_m)} <span className="text-2xl font-medium">km</span>
      </p>

      {run.zone && (
        <p className="mt-2 text-sm">
          {zoneLabel(run.zone)}
          {range && ` · ${range[0]}–${range[1]} bpm`}
        </p>
      )}
      {run.extras?.map((extra, i) => (
        <p key={i} className="text-sm">
          + {extra.reps && `${extra.reps} × `}
          {duration(extra.duration_s)} {extra.type}
        </p>
      ))}

      {run.blocks && (
        <ol className="mt-5 space-y-3 border-t border-accent-ink/20 pt-4">
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
    </section>
  );
}
