import { describe, expect, it } from "vitest";

import type { Activity } from "./activities";
import { checkPlan, historyRange } from "./check";
import { plan as realPlan, type Plan } from "./plan";
import { LONG_RUN_SPIKE } from "./rules";

// One week whose only long run needs history to pass: 15 km against 8 km planned before it.
const plan: Plan = {
  name: "Test plan",
  race: { date: "2026-11-08", distance_m: 21097, goal_time_s: 6600 },
  zones: {},
  weeks: [
    {
      index: 1,
      start: "2026-10-19",
      cutback: false,
      sessions: [
        { date: "2026-10-20", kind: "run", type: "easy", distance_m: 7000 },
        { date: "2026-10-21", kind: "run", type: "tempo", distance_m: 8000 },
        { date: "2026-10-24", kind: "run", type: "long", distance_m: 15000 },
      ],
    },
  ],
};

function activity(date: string, km: number, type = "running"): Activity {
  return { id: date, date, type, distance_m: km * 1000, duration_s: km * 360, avg_hr: null };
}

function spikes(p: Plan, activities: Activity[]) {
  return checkPlan(p, activities).filter((f) => f.code === LONG_RUN_SPIKE);
}

describe("historyRange", () => {
  it("is the 30 days before the plan starts", () => {
    expect(historyRange(plan)).toEqual({ from: "2026-09-19", to: "2026-10-18" });
  });
});

describe("checkPlan", () => {
  it("compares the first long run with Garmin runs before the plan", () => {
    expect(spikes(plan, [activity("2026-10-17", 14)])).toEqual([]);
  });

  it("still catches a spike over the Garmin history", () => {
    const found = spikes(plan, [activity("2026-10-17", 12)]);
    expect(found.map((f) => [f.day, f.severity])).toEqual([["2026-10-24", "error"]]);
  });

  it("counts treadmill and trail runs, not other activities", () => {
    expect(spikes(plan, [activity("2026-10-17", 14, "treadmill_running")])).toEqual([]);
    expect(spikes(plan, [activity("2026-10-17", 14, "cycling")])).toHaveLength(1);
  });

  it("ignores activities outside the history range", () => {
    // Done inside the plan: the planned run on that day stands in for it.
    expect(spikes(plan, [activity("2026-10-19", 14)])).toHaveLength(1);
    // Older than the 30-day window.
    expect(spikes(plan, [activity("2026-09-18", 14)])).toHaveLength(1);
  });
});

// data/plan.json with the two weeks Joey ran before it (Garmin, Oct 5-18). If a plan edit makes
// an error here, the plan needs changing, not this test.
describe("the real plan", () => {
  const before = [
    activity("2026-10-08", 5.2), activity("2026-10-10", 10),
    activity("2026-10-13", 7.1), activity("2026-10-14", 7), activity("2026-10-15", 6), activity("2026-10-17", 14),
  ];

  it("starts the day after this history", () => {
    expect(historyRange(realPlan).to).toBe("2026-10-18");
  });

  it("has no errors", () => {
    expect(checkPlan(realPlan, before).filter((f) => f.severity === "error")).toEqual([]);
  });
});
