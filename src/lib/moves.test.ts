import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import type { Activity } from "./activities";
import { moveError, moveWarnings, saveMove, savedMoves, withMoves } from "./moves";
import { sessionsOn, type Plan, type Session } from "./plan";
import { weekOf } from "./week";

const dir = mkdtempSync(path.join(tmpdir(), "cadent-moves-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// Week 26's shape: lifts Mon/Wed/Sat, runs every day but Monday and Friday, Fri the rest day.
const SESSIONS: Session[] = [
  { date: "2026-10-26", kind: "lift", name: "Full-body A" },
  { date: "2026-10-27", kind: "run", type: "easy", distance_m: 8000 },
  { date: "2026-10-28", kind: "run", type: "tempo", distance_m: 8000 },
  { date: "2026-10-28", kind: "lift", name: "Full-body B", after_run: true },
  { date: "2026-10-29", kind: "run", type: "easy", distance_m: 7000 },
  { date: "2026-10-31", kind: "run", type: "long", distance_m: 15000 },
  { date: "2026-10-31", kind: "lift", name: "Upper", after_run: true },
  { date: "2026-11-01", kind: "run", type: "easy", distance_m: 5000 },
];
const PLAN: Plan = {
  name: "Test",
  race: { date: "2027-05-02", distance_m: 21097, goal_time_s: 6600 },
  zones: {},
  weeks: [{ index: 17, start: "2026-10-26", cutback: false, sessions: SESSIONS }],
};

const runOn = (plan: Plan, day: string) => sessionsOn(plan, day).find((s) => s.kind === "run");

function activity(date: string, distance_m: number): Activity {
  return { id: date, date, type: "running", distance_m, duration_s: 3000, avg_hr: null };
}

describe("withMoves", () => {
  it("puts a moved run on its new day and leaves the lifts", () => {
    const moved = withMoves(PLAN, { "2026-10-27": "2026-10-30" });
    expect(runOn(moved, "2026-10-27")).toBeUndefined();
    expect(runOn(moved, "2026-10-30")).toMatchObject({ type: "easy", distance_m: 8000, planned_date: "2026-10-27" });
    expect(sessionsOn(moved, "2026-10-28").map((s) => s.kind)).toEqual(["run", "lift"]);
  });

  it("ignores a move out of the run's week, left over from an older plan", () => {
    const moved = withMoves(PLAN, { "2026-10-27": "2026-11-03" });
    expect(runOn(moved, "2026-10-27")).not.toHaveProperty("planned_date");
  });

  it("ignores a leftover move onto a day that already has a run", () => {
    const moved = withMoves(PLAN, { "2026-10-27": "2026-10-29", "2026-10-28": "2026-10-30", "2026-10-31": "2026-10-30" });
    expect(sessionsOn(moved, "2026-10-29").filter((s) => s.kind === "run")).toHaveLength(1);
    expect(sessionsOn(moved, "2026-10-30").filter((s) => s.kind === "run")).toHaveLength(1);
    expect(runOn(moved, "2026-10-31")).toMatchObject({ type: "long" });
  });
});

describe("a moved week against Garmin", () => {
  it("counts the run on its new day, and still shows a run on the day it left", () => {
    const moved = withMoves(PLAN, { "2026-10-27": "2026-10-26" });
    const ran = [activity("2026-10-26", 8200), activity("2026-10-27", 5000)];
    const week = weekOf(moved, ran, "2026-10-29");
    expect(week?.days[0]).toMatchObject({ planned_m: 8000, actual_m: 8200, status: "done" });
    expect(week?.days[1]).toMatchObject({ planned_m: 0, actual_m: 5000, status: "extra" });
    expect(week?.actual_m).toBe(13200);
  });
});

describe("moveError", () => {
  it("allows a free day in the same week", () => {
    expect(moveError(PLAN, "2026-10-27", "2026-10-30")).toBeUndefined();
    expect(moveError(PLAN, "2026-10-27", "2026-10-26")).toBeUndefined();
  });

  it("refuses another week, the same day, a day with a run, or a day with nothing to move", () => {
    expect(moveError(PLAN, "2026-10-27", "2026-11-02")).toMatch(/this week/);
    expect(moveError(PLAN, "2026-10-27", "2026-10-27")).toMatch(/this week/);
    expect(moveError(PLAN, "2026-10-27", "not-a-day")).toMatch(/this week/);
    expect(moveError(PLAN, "2026-10-27", "2026-10-29")).toMatch(/already has a run/);
    expect(moveError(PLAN, "2026-10-30", "2026-10-26")).toMatch(/no run/);
  });
});

describe("moveWarnings", () => {
  it("is quiet for the plan as written", () => {
    expect(moveWarnings(PLAN, "2026-10-27")).toEqual([]);
  });

  it("flags a week with no rest day", () => {
    // Tuesday's run on Friday leaves Tuesday free; Wednesday's keeps its lift there.
    expect(moveWarnings(withMoves(PLAN, { "2026-10-27": "2026-10-30" }), "2026-10-30")).toEqual([]);
    expect(moveWarnings(withMoves(PLAN, { "2026-10-28": "2026-10-30" }), "2026-10-30")[0]).toMatch(/rest day/);
  });

  it("flags a long run the day after a full-body lift", () => {
    const moved = withMoves(PLAN, { "2026-10-29": "2026-10-30", "2026-10-31": "2026-10-29" });
    expect(moveWarnings(moved, "2026-10-29")).toContainEqual(expect.stringMatching(/full-body/));
  });
});

describe("saveMove", () => {
  it("saves, replaces and deletes a move", () => {
    const file = path.join(dir, "cadent.db");
    expect(savedMoves(file)).toEqual({});
    saveMove("2026-10-27", "2026-10-30", file);
    saveMove("2026-10-27", "2026-10-26", file);
    expect(savedMoves(file)).toEqual({ "2026-10-27": "2026-10-26" });
    saveMove("2026-10-27", "2026-10-27", file);
    expect(savedMoves(file)).toEqual({});
  });
});
