import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import type { Activity } from "./activities";
import { changedPlan, checkChange, saveChange, savedChanges, tryChange, withChanges } from "./changes";
import { withMoves } from "./moves";
import { sessionsOn, type Plan } from "./plan";

const dir = mkdtempSync(path.join(tmpdir(), "cadent-changes-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const PLAN: Plan = {
  name: "Test",
  race: { date: "2027-05-02", distance_m: 21097, goal_time_s: 6600 },
  zones: {},
  weeks: [
    {
      index: 1,
      start: "2026-11-02",
      cutback: false,
      sessions: [
        { date: "2026-11-03", kind: "run", type: "easy", distance_m: 8000 },
        { date: "2026-11-07", kind: "run", type: "long", distance_m: 14000 },
      ],
    },
  ],
};

// Longest run in the 30 days before the plan: 14 km, so a long run may be up to 15.4 km.
const HISTORY: Activity[] = [{ id: "1", date: "2026-10-25", type: "running", distance_m: 14000, duration_s: 5000, avg_hr: null }];

const runOn = (plan: Plan, day: string) => sessionsOn(plan, day).find((s) => s.kind === "run");

describe("withChanges", () => {
  it("sets the distance by the plan's date, and a move still carries it", () => {
    const changed = withChanges(PLAN, { "2026-11-03": 6000 });
    expect(runOn(changed, "2026-11-03")).toMatchObject({ distance_m: 6000, planned_distance_m: 8000 });
    expect(runOn(changed, "2026-11-07")).not.toHaveProperty("planned_distance_m");
    const moved = withMoves(changed, { "2026-11-03": "2026-11-04" });
    expect(runOn(moved, "2026-11-04")).toMatchObject({ distance_m: 6000, planned_date: "2026-11-03" });
  });
});

describe("checkChange", () => {
  it("allows a change within the rules", () => {
    expect(checkChange(PLAN, HISTORY, "2026-11-07", 15000, "2026-11-01")).toEqual({ warnings: [] });
  });

  it("refuses a long run over the 110% limit", () => {
    expect(checkChange(PLAN, HISTORY, "2026-11-07", 16000, "2026-11-01")).toHaveProperty("error");
  });

  it("allows a short run but says it's under the minimum", () => {
    const result = checkChange(PLAN, HISTORY, "2026-11-03", 4000, "2026-11-01");
    expect(result).toEqual({ warnings: [expect.stringContaining("under the 5 km minimum")] });
  });

  it("refuses lengthening a run that already breaks a rule, but allows shortening it", () => {
    const over = withChanges(PLAN, { "2026-11-07": 18000 });
    expect(checkChange(over, HISTORY, "2026-11-07", 30000, "2026-11-01")).toHaveProperty("error");
    expect(checkChange(over, HISTORY, "2026-11-07", 17000, "2026-11-01")).toHaveProperty("warnings");
  });

  it("judges the past by the day the run is on now", () => {
    expect(checkChange(PLAN, HISTORY, "2026-11-03", 6000, "2026-11-04", "2026-11-06")).toEqual({ warnings: [] });
    expect(checkChange(PLAN, HISTORY, "2026-11-07", 15000, "2026-11-05", "2026-11-04")).toHaveProperty("error");
  });

  it("refuses past runs, days with no run, and silly distances", () => {
    expect(checkChange(PLAN, HISTORY, "2026-11-03", 6000, "2026-11-04")).toHaveProperty("error");
    expect(checkChange(PLAN, HISTORY, "2026-11-04", 6000, "2026-11-01")).toHaveProperty("error");
    expect(checkChange(PLAN, HISTORY, "2026-11-03", 80000, "2026-11-01")).toHaveProperty("error");
    expect(checkChange(PLAN, HISTORY, "2026-11-03", 6000.5, "2026-11-01")).toHaveProperty("error");
  });
});

describe("saveChange", () => {
  it("saves, replaces and resets a change", () => {
    const file = path.join(dir, "cadent.db");
    expect(savedChanges(file)).toEqual({});
    saveChange("2026-11-03", 6000, file);
    saveChange("2026-11-03", 7000, file);
    expect(savedChanges(file)).toEqual({ "2026-11-03": 7000 });
    saveChange("2026-11-03", undefined, file);
    expect(savedChanges(file)).toEqual({});
  });
});

describe("tryChange", () => {
  // Against data/plan.json, since tryChange reads the plan as written: its first run, checked from a day before it.
  const file = path.join(dir, "try.db");
  const { plan } = changedPlan(file);
  const first = plan.weeks.flatMap((w) => w.sessions).find((s) => s.kind === "run")!;
  const before = "2000-01-01";

  it("saves an allowed change, which changedPlan then applies, and resets it", () => {
    expect(tryChange(first.date, 5500, before, first.date, file)).not.toHaveProperty("error");
    expect(savedChanges(file)).toEqual({ [first.date]: 5500 });
    expect(runOn(changedPlan(file).plan, first.date)).toMatchObject({ distance_m: 5500 });
    tryChange(first.date, undefined, before, first.date, file);
    expect(savedChanges(file)).toEqual({});
  });

  it("saves nothing when the change is refused", () => {
    expect(tryChange(first.date, 500, before, first.date, file)).toHaveProperty("error");
    expect(savedChanges(file)).toEqual({});
  });
});
