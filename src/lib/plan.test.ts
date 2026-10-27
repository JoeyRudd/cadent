import { describe, expect, it } from "vitest";

import { localDate, nextRun, sessionsOn, type Plan } from "./plan";

// A two-week plan, so editing data/plan.json never breaks these tests.
const plan: Plan = {
  name: "Test plan",
  race: { date: "2026-11-08", distance_m: 21097, goal_time_s: 6600 },
  zones: { z2: [142, 158] },
  weeks: [
    {
      index: 1,
      start: "2026-10-26",
      cutback: false,
      sessions: [
        { date: "2026-10-26", kind: "lift", name: "Full-body A" },
        { date: "2026-10-27", kind: "run", type: "easy", distance_m: 5000 },
        { date: "2026-10-28", kind: "run", type: "tempo", distance_m: 7000 },
        { date: "2026-10-28", kind: "lift", name: "Full-body B", after_run: true },
        { date: "2026-10-31", kind: "run", type: "long", distance_m: 14000 },
      ],
    },
    {
      index: 2,
      start: "2026-11-02",
      cutback: false,
      sessions: [{ date: "2026-11-08", kind: "run", type: "race", distance_m: 21097 }],
    },
  ],
};

describe("localDate", () => {
  it("uses Toronto's date, not UTC's", () => {
    expect(localDate(new Date("2026-10-28T03:30:00Z"))).toBe("2026-10-27");
  });

  it("handles the DST change (Nov 1, 2026)", () => {
    expect(localDate(new Date("2026-11-01T04:30:00Z"))).toBe("2026-11-01");
    expect(localDate(new Date("2026-11-02T04:30:00Z"))).toBe("2026-11-01");
  });
});

describe("sessionsOn", () => {
  it("returns a run and its lift on the same day", () => {
    expect(sessionsOn(plan, "2026-10-28").map((s) => s.kind)).toEqual(["run", "lift"]);
  });

  it("returns only the lift on a lift-only day", () => {
    expect(sessionsOn(plan, "2026-10-26")).toEqual([
      { date: "2026-10-26", kind: "lift", name: "Full-body A" },
    ]);
  });

  it("returns nothing on a full rest day", () => {
    expect(sessionsOn(plan, "2026-10-29")).toEqual([]);
  });
});

describe("nextRun", () => {
  it("finds the next run after a rest day", () => {
    expect(nextRun(plan, "2026-10-29")).toMatchObject({ date: "2026-10-31", type: "long" });
  });

  it("skips today's own run", () => {
    expect(nextRun(plan, "2026-10-27")?.date).toBe("2026-10-28");
  });

  it("finds nothing after race day", () => {
    expect(nextRun(plan, plan.race.date)).toBeUndefined();
  });
});
