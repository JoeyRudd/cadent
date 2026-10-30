import Link from "next/link";

import { Chevron } from "@/components/Chevron";
import { StatusPill } from "@/components/StatusPill";
import { ROW_LINK } from "@/components/iconButton";
import { km, runTypeLabel, shortDayLabel, timeAndPace } from "@/lib/format";
import type { RecentRun } from "@/lib/run";

// One recorded day in a list: when, what kind of run, how far, how long and how fast. It opens
// that day's run.
export function RunRow({ run: { date, type, recorded, status } }: { run: RecentRun }) {

  return (
    <Link
      href={`/run/${date}`}
      className={`flex min-h-16 items-center gap-3 px-4 py-3 ${ROW_LINK}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{shortDayLabel(date)}</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
          {type ? runTypeLabel(type) : "Run"}
          {/* On plan is the usual case, so only the days that differ get a pill. */}
          {status && status !== "done" && <StatusPill status={status} />}
        </p>
      </div>
      <div className="text-right">
        <p className="text-lg font-semibold">
          {km(recorded.distance_m)} <span className="text-sm font-medium text-muted">km</span>
        </p>
        <p className="text-sm text-muted">{timeAndPace(recorded.duration_s, recorded.pace_s_per_km)}</p>
      </div>
      <Chevron />
    </Link>
  );
}
