"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { km } from "@/lib/format";
import type { Week } from "@/lib/week";

// The whole plan as one bar per week: the outline is the planned distance, the fill what was run.
// Each bar opens its week. Client-side only to keep the open week scrolled into view.
export function WeekPicker({
  weeks,
  selected,
  current,
}: {
  weeks: Pick<Week, "index" | "planned_m" | "actual_m">[];
  selected: number;
  current?: number;
}) {
  const selectedRef = useRef<HTMLAnchorElement>(null);
  const tallest = Math.max(...weeks.map((w) => w.planned_m), 1);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [selected]);

  return (
    <nav aria-label="Plan weeks" className="-mx-4 overflow-x-auto px-4">
      <ol className="flex w-max gap-1 rounded-card bg-surface p-2">
        {weeks.map((week) => {
          const isSelected = week.index === selected;
          const isCurrent = week.index === current;
          const done = week.planned_m > 0 ? Math.min(100, (week.actual_m / week.planned_m) * 100) : 0;
          return (
            <li key={week.index}>
              <Link
                ref={isSelected ? selectedRef : undefined}
                href={`/week?w=${week.index}`}
                aria-current={isSelected ? "page" : undefined}
                aria-label={`Week ${week.index}${isCurrent ? ", this week" : ""}: ${km(week.actual_m)} of ${km(week.planned_m)} km`}
                className={`flex w-11 flex-col items-center gap-1 rounded-button pt-2 pb-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-accent ${
                  isSelected ? "bg-accent-soft text-accent-ink" : "text-muted"
                }`}
              >
                <span aria-hidden="true" className="flex h-12 w-3 items-end">
                  {/* Heights are data, so they can't be classes. */}
                  <span
                    className="flex w-full items-end overflow-hidden rounded-full border border-muted"
                    style={{ height: `${Math.max(8, (week.planned_m / tallest) * 100)}%` }}
                  >
                    <span className="w-full bg-accent" style={{ height: `${done}%` }} />
                  </span>
                </span>
                <span aria-hidden="true">{week.index}</span>
                <span aria-hidden="true" className={`size-1 rounded-full ${isCurrent ? "bg-accent" : ""}`} />
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
