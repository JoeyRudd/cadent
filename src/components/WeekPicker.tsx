"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { km } from "@/lib/format";

type WeekTotal = { index: number; start: string; planned_m: number; actual_m: number };

// Every week of the plan as a bar: the outline is the planned distance, the fill what was run.
// Each bar is a full 44px target that jumps to its week, so the strip scrolls sideways; it's a
// client component only to keep the shown week scrolled into view.
export function WeekPicker({ weeks, shown, thisWeek }: { weeks: WeekTotal[]; shown: string; thisWeek: string }) {
  const shownRef = useRef<HTMLAnchorElement>(null);
  const most = Math.max(...weeks.map((w) => w.planned_m), 1);

  useEffect(() => {
    shownRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [shown]);

  return (
    <nav aria-label="Weeks of the plan" data-scrolls-x className="-mx-4 mt-4 overflow-x-auto px-4">
      <ol className="flex w-max gap-1 rounded-card bg-surface p-2">
        {weeks.map((w) => {
          const isShown = w.start === shown;
          const isThisWeek = w.start === thisWeek;
          const done = w.planned_m > 0 ? Math.min(100, (w.actual_m / w.planned_m) * 100) : 0;
          return (
            <li key={w.start}>
              <Link
                ref={isShown ? shownRef : undefined}
                href={`/week?start=${w.start}`}
                aria-current={isShown ? "page" : undefined}
                aria-label={`Week ${w.index}${isThisWeek ? ", this week" : ""}: ${km(w.actual_m)} of ${km(w.planned_m)} km`}
                className={`flex w-11 flex-col items-center gap-1 rounded-button pt-2 pb-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-accent ${
                  isShown ? "bg-accent-soft text-accent-ink" : "text-muted"
                }`}
              >
                <span aria-hidden="true" className="flex h-12 w-3 items-end">
                  {/* Heights are data, so they can't be classes. */}
                  <span
                    className="flex w-full items-end overflow-hidden rounded-full border border-muted"
                    style={{ height: `${Math.max(8, (w.planned_m / most) * 100)}%` }}
                  >
                    <span className="w-full bg-accent" style={{ height: `${done}%` }} />
                  </span>
                </span>
                <span aria-hidden="true">{w.index}</span>
                <span aria-hidden="true" className={`size-1 rounded-full ${isThisWeek ? "bg-accent" : ""}`} />
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
