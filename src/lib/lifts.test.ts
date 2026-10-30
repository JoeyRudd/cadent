import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { saveLiftDay, savedLiftDays, withLifts } from "./lifts";
import { moveWarnings } from "./moves";
import { sessionsOn, type Plan } from "./plan";

const dir = mkdtempSync(path.join(tmpdir(), "cadent-lifts-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// One week: a full-body lift Monday, runs Tuesday and the long run Saturday, the rest of the days free.
const PLAN: Plan = {
  name: "Test",
  race: { date: "2027-05-02", distance_m: 21097, goal_time_s: 6600 },
  zones: {},
  weeks: [
    {
      index: 17,
      start: "2026-10-26",
      cutback: false,
      sessions: [
        { date: "2026-10-26", kind: "lift", name: "Full-body A" },
        { date: "2026-10-27", kind: "run", type: "easy", distance_m: 8000 },
        { date: "2026-10-31", kind: "run", type: "long", distance_m: 15000 },
      ],
    },
  ],
};

const liftOn = (plan: Plan, day: string) => sessionsOn(plan, day).find((s) => s.kind === "lift");

describe("withLifts", () => {
  it("adds a lift, takes a plan lift off, and leaves runs and unmarked days alone", () => {
    const lifted = withLifts(PLAN, { "2026-10-26": null, "2026-10-29": "Upper body" });
    expect(liftOn(lifted, "2026-10-26")).toBeUndefined();
    expect(liftOn(lifted, "2026-10-29")).toEqual({ date: "2026-10-29", kind: "lift", name: "Upper body" });
    expect(sessionsOn(lifted, "2026-10-27")).toEqual(sessionsOn(PLAN, "2026-10-27"));
    expect(lifted.weeks[0].sessions.map((s) => s.date)).toEqual(["2026-10-27", "2026-10-29", "2026-10-31"]);
  });

  it("replaces a plan lift rather than adding a second one", () => {
    const lifted = withLifts(PLAN, { "2026-10-26": "Lower body" });
    expect(sessionsOn(lifted, "2026-10-26")).toEqual([{ date: "2026-10-26", kind: "lift", name: "Lower body" }]);
  });

  it("ignores a day outside the plan", () => {
    expect(withLifts(PLAN, { "2027-06-01": "Full-body" })).toEqual(PLAN);
  });

  it("counts an added full-body lift for the rest-day rules", () => {
    expect(moveWarnings(PLAN, "2026-10-30")).toEqual([]);
    expect(moveWarnings(withLifts(PLAN, { "2026-10-30": "Full-body" }), "2026-10-30")).toContain(
      "The long run is the day after a full-body lift. The plan keeps those apart.",
    );
  });
});

describe("saveLiftDay", () => {
  it("is empty before anything is marked", () => {
    expect(savedLiftDays(path.join(dir, "missing.db"))).toEqual({});
  });

  it("saves, replaces, and deletes the row once a day is back to the plan's lift", () => {
    const file = path.join(dir, "cadent.db");
    saveLiftDay("2026-10-29", "Upper body", undefined, file);
    saveLiftDay("2026-10-26", null, "Full-body A", file);
    expect(savedLiftDays(file)).toEqual({ "2026-10-29": "Upper body", "2026-10-26": null });

    saveLiftDay("2026-10-29", "Lower body", undefined, file);
    saveLiftDay("2026-10-26", "Full-body A", "Full-body A", file);
    saveLiftDay("2026-10-29", null, undefined, file);
    expect(savedLiftDays(file)).toEqual({});
  });
});
