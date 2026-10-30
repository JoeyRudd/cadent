"use client";

import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition, type PointerEvent, type ReactNode } from "react";

import type { MoveResult } from "@/app/run/[date]/actions";
import { weekday } from "@/lib/format";
import type { WeekDay } from "@/lib/week";

import { WeekDayRow, type DropState } from "./WeekDayRow";

/** How long a finger rests on a run before it lifts. */
const HOLD_MS = 300;
/** Moving further than this during the hold means scrolling or swiping, not a pick-up. */
const SLOP_PX = 8;
/** A horizontal swipe at least this long changes the week. */
const SWIPE_PX = 60;

type Press = { pointerId: number; x: number; y: number; touch: boolean; timer?: ReturnType<typeof setTimeout> };
type Drag = { from: string; startY: number; dy: number; over?: string; slots: [string, DOMRect][] };
type Toast = { text: string; warnings: string[]; undo?: { from: string; to: string }; error?: boolean };

/** `days` with the run on `from` shown on `to` while the move saves. */
function moveDay(days: WeekDay[], { from, to }: { from: string; to: string }): WeekDay[] {
  const source = days.find((d) => d.date === from);
  if (!source) return days;
  return days.map((d) => {
    if (d.date === to) return { ...d, runs: source.runs, planned_m: source.planned_m };
    if (d.date === from) return { ...d, runs: [], planned_m: 0 };
    return d;
  });
}

// The Week page's days. Hold a run about 300 ms to pick it up, then drop it on another day of the
// week; Undo puts it back. A horizontal swipe on a phone opens `prev` or `next`. `targets` maps each day
// whose run can move to the days it can move to (moveError's rules), so the board never guesses.
// Run detail's MoveRun is the keyboard and screen reader way to move a run.
export function WeekBoard({
  days,
  today,
  targets,
  move,
  prev,
  next,
  children,
}: {
  days: WeekDay[];
  today: string;
  targets: Record<string, string[]>;
  move: (from: string, to: string) => Promise<MoveResult>;
  prev?: string;
  next?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const press = useRef<Press | undefined>(undefined);
  // The drag lives in a ref for the event handlers and in state for rendering.
  const dragging = useRef<Drag | undefined>(undefined);
  const justDropped = useRef(false);
  const [drag, setDrag] = useState<Drag>();
  const [toast, setToast] = useState<Toast>();
  const [pending, startTransition] = useTransition();
  const [shown, showMove] = useOptimistic(days, moveDay);

  // While a run is up, the finger moves it instead of scrolling the page. Touch events, since
  // pointer events can't stop a scroll that touch-action allows.
  useEffect(() => {
    const el = root.current;
    const stop = (e: TouchEvent) => {
      if (dragging.current) e.preventDefault();
    };
    el?.addEventListener("touchmove", stop, { passive: false });
    return () => {
      el?.removeEventListener("touchmove", stop);
      // Leaving the week mid-hold mustn't lift a run on a board that's gone.
      clearTimeout(press.current?.timer);
    };
  }, []);

  function updateDrag(value: Drag | undefined) {
    dragging.current = value;
    setDrag(value);
  }

  function save(from: string, to: string, undoing: boolean) {
    startTransition(async () => {
      showMove({ from, to });
      const result = await move(from, to);
      if ("error" in result) {
        setToast({ text: result.error, warnings: [], error: true });
      } else {
        const text = undoing ? `Moved back to ${weekday(to)}` : `Moved to ${weekday(to)}`;
        setToast({ text, warnings: result.warnings, undo: undoing ? undefined : { from: to, to: from } });
      }
    });
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    // A drag that ends after moving fires no click, so the flag can't wait for one.
    justDropped.current = false;
    // A second finger means a pinch, not a drag: drop the first press too.
    if (press.current) return onPointerCancel();
    if (e.button !== 0 || pending) return;
    // Scrolling a strip sideways isn't a swipe to another week.
    if ((e.target as Element).closest("[data-scrolls-x]")) return;
    const from = (e.target as Element).closest<HTMLElement>("[data-day]")?.dataset.day;
    const p: Press = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType === "touch" };
    if (from && targets[from]) {
      p.timer = setTimeout(() => {
        p.timer = undefined;
        // Where each day sits before anything moves, so the lifted row can't hide its own target.
        const rows = root.current?.querySelectorAll<HTMLElement>("[data-day]") ?? [];
        const slots = [...rows].map((el): [string, DOMRect] => [el.dataset.day!, el.getBoundingClientRect()]);
        root.current?.setPointerCapture(p.pointerId);
        navigator.vibrate?.(10);
        updateDrag({ from, startY: p.y, dy: 0, slots });
      }, HOLD_MS);
    }
    press.current = p;
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerId !== press.current?.pointerId) return;
    const d = dragging.current;
    if (d) {
      const over = d.slots.find(([, rect]) => rect.top <= e.clientY && e.clientY < rect.bottom)?.[0];
      updateDrag({ ...d, dy: e.clientY - d.startY, over });
      return;
    }
    const p = press.current;
    if (p?.timer && Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP_PX) {
      clearTimeout(p.timer);
      p.timer = undefined;
    }
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerId !== press.current?.pointerId) return;
    const p = press.current;
    const d = dragging.current;
    press.current = undefined;
    clearTimeout(p?.timer);
    if (d) {
      updateDrag(undefined);
      justDropped.current = true;
      if (d.over && targets[d.from].includes(d.over)) save(d.from, d.over, false);
      return;
    }
    if (!p?.touch) return;
    const dx = e.clientX - p.x;
    const href = dx < 0 ? next : prev;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > 2 * Math.abs(e.clientY - p.y) && href) router.push(href);
  }

  function onPointerCancel() {
    clearTimeout(press.current?.timer);
    press.current = undefined;
    updateDrag(undefined);
  }

  const dropState = (date: string): DropState | undefined => {
    if (!drag || date === drag.from) return undefined;
    if (!targets[drag.from].includes(date)) return "taken";
    return date === drag.over ? "over" : "free";
  };

  return (
    <div
      ref={root}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      // A drop isn't a tap on the run's link, and a long press isn't a context menu.
      onClickCapture={(e) => {
        // Only a row's link: Undo pressed from the keyboard right after a drop is a real click.
        if (!justDropped.current || !(e.target as Element).closest("[data-day]")) return;
        justDropped.current = false;
        e.preventDefault();
        e.stopPropagation();
      }}
      onContextMenu={(e) => {
        if (press.current?.timer || dragging.current) e.preventDefault();
      }}
      onDragStart={(e) => e.preventDefault()}
      className="touch-pan-y touch-pinch-zoom select-none"
      // No iOS link preview on a long press. Not a colour or size, so not a token.
      style={{ WebkitTouchCallout: "none" }}
    >
      {children}

      <ul className={`mt-4 divide-y divide-line rounded-card bg-surface ${drag ? "" : "overflow-hidden"}`}>
        {shown.map((day) => {
          const lifted = drag?.from === day.date;
          return (
            <li
              key={day.date}
              data-day={day.date}
              className={
                lifted ? "relative z-10 overflow-hidden rounded-card bg-surface shadow-lg outline-2 outline-accent" : ""
              }
              // The row follows the finger, so its offset is data.
              style={lifted ? { transform: `translateY(${drag.dy}px)` } : undefined}
            >
              <WeekDayRow day={day} isToday={day.date === today} drop={dropState(day.date)} />
            </li>
          );
        })}
      </ul>

      {Object.values(targets).some((days) => days.length > 0) && (
        <p className="mt-3 px-4 text-sm text-muted">Hold a run to move it to another day this week.</p>
      )}

      <div aria-live="polite" className="fixed inset-x-0 bottom-tabbar px-4">
        {(pending || toast) && (
          <div className="mx-auto flex max-w-md items-start gap-3 rounded-card border border-line bg-surface p-4 shadow-lg">
            <div className="min-w-0 flex-1">
              <p className={`font-semibold ${toast?.error && !pending ? "text-off-plan" : ""}`}>
                {pending ? "Moving the run" : toast?.text}
              </p>
              {!pending &&
                toast?.warnings.map((warning) => (
                  <p key={warning} className="mt-1 text-sm text-warning">
                    {warning}
                  </p>
                ))}
            </div>
            {!pending && toast?.undo && (
              <button
                type="button"
                onClick={() => save(toast.undo!.from, toast.undo!.to, true)}
                className="-my-2 h-11 rounded-button px-3 font-semibold text-accent hover:bg-accent-soft active:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
              >
                Undo
              </button>
            )}
            {!pending && (
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setToast(undefined)}
                className="-my-2 -mr-2 flex size-11 items-center justify-center rounded-full text-muted hover:bg-bg active:bg-bg focus-visible:outline-2 focus-visible:outline-accent"
              >
                <svg
                  aria-hidden="true"
                  className="size-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
