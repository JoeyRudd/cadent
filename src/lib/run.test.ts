import { describe, expect, it } from "vitest";

import type { Activity } from "./activities";
import type { Plan } from "./plan";
import { runDetail } from "./run";

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
        { date: "2026-10-27", kind: "run", type: "easy", distance_m: 6000, zone: "z2" },
        { date: "2026-10-28", kind: "run", type: "tempo", distance_m: 8000 },
      ],
    },
  ],
};

function activity(overrides: Partial<Activity>): Activity {
  return {
    id: "1",
    date: "2026-10-27",
    type: "running",
    distance_m: 6200,
    duration_s: 2480,
    avg_hr: 151,
    ...overrides,
  };
}

const TODAY = "2026-10-30";

describe("runDetail", () => {
  it("compares a recorded run with the plan", () => {
    expect(runDetail(plan, [activity({})], "2026-10-27", TODAY)).toEqual({
      run: plan.weeks[0].sessions[0],
      planned_m: 6000,
      recorded: { distance_m: 6200, duration_s: 2480, pace_s_per_km: 400, avg_hr: 151 },
      status: "done",
      zone: [142, 158],
      hr: "in",
    });
  });

  it("flags distance and heart rate outside the plan", () => {
    const detail = runDetail(plan, [activity({ distance_m: 5000, avg_hr: 165 })], "2026-10-27", TODAY);
    expect(detail.status).toBe("short");
    expect(detail.hr).toBe("above");
  });

  it("combines several runs, averaging heart rate over time and skipping other sports", () => {
    const { recorded } = runDetail(
      plan,
      [
        activity({ id: "1", distance_m: 3000, duration_s: 1000, avg_hr: 140 }),
        activity({ id: "2", distance_m: 3000, duration_s: 3000, avg_hr: 160 }),
        activity({ id: "3", distance_m: 3000, duration_s: 3000, avg_hr: null }),
        activity({ id: "4", type: "cycling", distance_m: 20000 }),
      ],
      "2026-10-27",
      TODAY,
    );
    expect(recorded).toEqual({ distance_m: 9000, duration_s: 7000, pace_s_per_km: 778, avg_hr: 155 });
  });

  it("has only the plan for a day without a run, and no heart rate verdict without a zone", () => {
    expect(runDetail(plan, [], "2026-10-28", TODAY)).toEqual({
      run: plan.weeks[0].sessions[1],
      planned_m: 8000,
      recorded: undefined,
      status: "missed",
      zone: undefined,
      hr: undefined,
    });
  });

  it("doesn't call today's partial run short", () => {
    const detail = runDetail(plan, [activity({ distance_m: 3000 })], "2026-10-27", "2026-10-27");
    expect(detail.status).toBe("upcoming");
  });

  it("has no pace for a run without distance", () => {
    expect(runDetail(plan, [activity({ distance_m: 0 })], "2026-10-27", TODAY).recorded?.pace_s_per_km).toBeNull();
  });

  it("keeps a run on a rest day as an extra", () => {
    const detail = runDetail(plan, [activity({ date: "2026-10-29" })], "2026-10-29", TODAY);
    expect(detail.run).toBeUndefined();
    expect(detail.recorded?.distance_m).toBe(6200);
    expect(detail.status).toBe("extra");
  });
});
