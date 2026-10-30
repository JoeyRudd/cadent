import Link from "next/link";

import { PRIMARY_BUTTON } from "@/components/iconButton";
import { StatusPill } from "@/components/StatusPill";
import { blockLabel, changedNote, extraLabel, km, paceTarget, runTypeLabel, timeAndPace, zoneLabel } from "@/lib/format";
import type { Lift, Plan, Run } from "@/lib/plan";
import type { WeekDay } from "@/lib/week";

// Today's run as the hero card: the distance is the number that matters. Once the run has synced,
// `done` says how it went; `lift` is the day's strength session, if any.
export function RunCard({
  run,
  zones,
  week,
  done,
  lift,
}: {
  run: Run;
  zones: Plan["zones"];
  week?: number;
  done?: Pick<WeekDay, "actual_m" | "duration_s" | "pace_s_per_km" | "status">;
  lift?: Lift;
}) {
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
      {changedNote(run) && <p className="-mt-1.5 text-sm">{changedNote(run)}</p>}

      {pills.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {pills.map((pill, i) => (
            <li key={i} className="rounded-full bg-surface px-2.5 py-1.5 text-sm text-ink">
              {pill}
            </li>
          ))}
        </ul>
      )}

      {done && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink">
          <span className="font-semibold">
            Done: {km(done.actual_m)} km, {timeAndPace(done.duration_s, done.pace_s_per_km)}
          </span>
          <StatusPill status={done.status} />
        </p>
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

      {lift && (
        <p className="text-sm">{lift.after_run ? `Lift after: ${lift.name}` : `Lift: ${lift.name}`}</p>
      )}

      <Link
        href={`/run/${run.date}`}
        className={`flex items-center justify-center ${PRIMARY_BUTTON}`}
      >
        {done ? "See your run" : "See session details"}
      </Link>
    </section>
  );
}
