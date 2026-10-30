"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { km, monthShort } from "@/lib/format";

type WeekTotal = { index: number; start: string; planned_m: number; actual_m: number; cutback: boolean };

// Every week of the plan as a bar: the outline is the planned distance (dashed for a cutback week),
// the fill what was run, with the month above where it changes. Each bar is a full 44px target that
// jumps to its week, so the strip scrolls sideways inside its frame; it's a client component only to
// keep the shown week centred.
export function WeekPicker({ weeks, shown, thisWeek }: { weeks: WeekTotal[]; shown: string; thisWeek: string }) {
  const strip = useRef<HTMLOListElement>(null);
  const shownRef = useRef<HTMLAnchorElement>(null);
  const most = Math.max(...weeks.map((w) => w.planned_m), 1);

  // Scrolls the strip itself, not the page, so choosing a week never makes the page jump.
  useEffect(() => {
    const [list, link] = [strip.current, shownRef.current];
    if (list && link) list.scrollLeft = link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2;
  }, [shown]);

  return (
    <nav aria-label="Weeks of the plan" data-scrolls-x className="overflow-hidden rounded-card bg-surface">
      <ol ref={strip} className="relative flex snap-x gap-1 overflow-x-auto p-2">
        {weeks.map((w, i) => {
          const isShown = w.start === shown;
          const isThisWeek = w.start === thisWeek;
          const done = w.planned_m > 0 ? Math.min(100, (w.actual_m / w.planned_m) * 100) : 0;
          const month = monthShort(w.start);
          const newMonth = i === 0 || month !== monthShort(weeks[i - 1].start);
          return (
            <li key={w.start} className="snap-center">
              <Link
                ref={isShown ? shownRef : undefined}
                href={`/week?start=${w.start}`}
                aria-current={isShown ? "page" : undefined}
                aria-label={`Week ${w.index}${isThisWeek ? ", this week" : ""}${w.cutback ? ", cutback" : ""}: ${km(w.actual_m)} of ${km(w.planned_m)} km`}
                className={`flex w-11 flex-col items-center gap-1 rounded-button py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-accent ${
                  isShown ? "bg-accent-soft text-accent-ink" : "text-muted"
                }`}
              >
                <span aria-hidden="true" className="h-4">
                  {newMonth ? month : ""}
                </span>
                <span aria-hidden="true" className="flex h-12 w-3 items-end">
                  {/* Heights are data, so they can't be classes. */}
                  <span
                    className={`flex w-full items-end overflow-hidden rounded-full border border-muted ${w.cutback ? "border-dashed" : ""}`}
                    style={{ height: `${Math.max(8, (w.planned_m / most) * 100)}%` }}
                  >
                    <span className="w-full bg-accent" style={{ height: `${done}%` }} />
                  </span>
                </span>
                <span aria-hidden="true">W{w.index}</span>
                <span aria-hidden="true" className={`size-1 rounded-full ${isThisWeek ? "bg-accent" : ""}`} />
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
