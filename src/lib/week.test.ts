import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, describe, expect, it } from "vitest";

import { activitiesBetween, type Activity } from "./activities";
import type { Plan } from "./plan";
import { dayParam, dayStatus, mondayOf, neighbourWeeks, planTotals, weekBounds, weekOf } from "./week";

// One week, so editing data/plan.json never breaks these tests.
const plan: Plan = {
  name: "Test plan",
  race: { date: "2026-11-08", distance_m: 21097, goal_time_s: 6600 },
  zones: {},
  weeks: [
    {
      index: 1,
      start: "2026-10-26",
      cutback: false,
      sessions: [
        { date: "2026-10-26", kind: "lift", name: "Full-body A" },
        { date: "2026-10-27", kind: "run", type: "easy", distance_m: 5000 },
        { date: "2026-10-28", kind: "run", type: "tempo", distance_m: 8000 },
        { date: "2026-10-30", kind: "run", type: "easy", distance_m: 6000 },
        { date: "2026-11-01", kind: "run", type: "long", distance_m: 14000 },
      ],
    },
  ],
};

function activity(date: string, distance_m: number, type = "running"): Activity {
  return { id: `${date}-${distance_m}`, date, type, distance_m, duration_s: 1800, avg_hr: null };
}

describe("dayStatus", () => {
  it("is on plan within ±10%", () => {
    expect(dayStatus(10000, 9000, "2026-10-27", "2026-10-28")).toBe("done");
    expect(dayStatus(10000, 11000, "2026-10-27", "2026-10-28")).toBe("done");
  });

  it("is short or over beyond 10%", () => {
    expect(dayStatus(10000, 8999, "2026-10-27", "2026-10-28")).toBe("short");
    expect(dayStatus(10000, 11001, "2026-10-27", "2026-10-28")).toBe("over");
  });

  it("isn't short yet while today is still going", () => {
    expect(dayStatus(10000, 3000, "2026-10-28", "2026-10-28")).toBe("upcoming");
  });

  it("is missed only once the day has passed", () => {
    expect(dayStatus(5000, 0, "2026-10-27", "2026-10-28")).toBe("missed");
    expect(dayStatus(5000, 0, "2026-10-28", "2026-10-28")).toBe("upcoming");
    expect(dayStatus(5000, 0, "2026-10-29", "2026-10-28")).toBe("upcoming");
  });

  it("is rest or extra run with nothing planned", () => {
    expect(dayStatus(0, 0, "2026-10-27", "2026-10-28")).toBe("rest");
    expect(dayStatus(0, 3000, "2026-10-27", "2026-10-28")).toBe("extra");
  });
});

describe("weekBounds", () => {
  it("runs Monday to Sunday", () => {
    const week = { start: "2026-10-26", end: "2026-11-01" };
    expect(weekBounds(plan, "2026-10-26")).toEqual(week);
    expect(weekBounds(plan, "2026-11-01")).toEqual(week);
  });

  it("is undefined outside the plan", () => {
    expect(weekBounds(plan, "2026-10-25")).toBeUndefined();
    expect(weekBounds(plan, "2026-11-02")).toBeUndefined();
  });
});

describe("weekOf", () => {
  const activities = [
    activity("2026-10-25", 9000), // the Sunday before: not this week
    activity("2026-10-26", 3000), // extra run on a lift day
    activity("2026-10-27", 3000),
    activity("2026-10-27", 2500), // two runs add up: 5.5 km of 5 km
    activity("2026-10-28", 5000, "cycling"), // not a run
  ];
  const week = weekOf(plan, activities, "2026-10-29")!;

  it("lists seven days from Monday with a status each", () => {
    expect(week.days.map((d) => [d.date, d.status])).toEqual([
      ["2026-10-26", "extra"],
      ["2026-10-27", "done"],
      ["2026-10-28", "missed"],
      ["2026-10-29", "rest"],
      ["2026-10-30", "upcoming"],
      ["2026-10-31", "rest"],
      ["2026-11-01", "upcoming"],
    ]);
  });

  it("lists each day's lifts next to its runs", () => {
    expect(week.days[0].lifts).toEqual([{ date: "2026-10-26", kind: "lift", name: "Full-body A" }]);
    expect(week.days[1].lifts).toEqual([]);
  });

  it("shows another week with statuses against today", () => {
    const past = weekOf(plan, activities, "2026-11-20", "2026-10-28")!;
    expect(past.start).toBe("2026-10-26");
    expect(past.days.map((d) => d.status)).toEqual(["extra", "done", "missed", "rest", "missed", "rest", "missed"]);
  });

  it("totals planned and actual distance", () => {
    expect(week.planned_m).toBe(33000);
    expect(week.actual_m).toBe(8500);
  });

  it("is undefined outside the plan", () => {
    expect(weekOf(plan, activities, "2026-11-02")).toBeUndefined();
  });
});

describe("mondayOf", () => {
  it("is the Monday of the day's calendar week", () => {
    expect(mondayOf("2026-10-26")).toBe("2026-10-26");
    expect(mondayOf("2026-10-29")).toBe("2026-10-26");
    expect(mondayOf("2026-11-01")).toBe("2026-10-26");
    expect(mondayOf("2026-01-01")).toBe("2025-12-29");
  });
});

describe("dayParam", () => {
  it("takes a real day", () => {
    expect(dayParam("2026-10-28")).toBe("2026-10-28");
  });

  it("ignores a missing, repeated or made-up day", () => {
    expect(dayParam(undefined)).toBeUndefined();
    expect(dayParam(["2026-10-26", "2026-11-02"])).toBeUndefined();
    expect(dayParam("2026-02-30")).toBeUndefined();
    expect(dayParam("next")).toBeUndefined();
  });
});

describe("neighbourWeeks", () => {
  const three: Plan = {
    ...plan,
    weeks: [
      { index: 1, start: "2026-10-26", cutback: false, sessions: [] },
      { index: 2, start: "2026-11-02", cutback: false, sessions: [] },
      { index: 3, start: "2026-11-09", cutback: false, sessions: [] },
    ],
  };

  it("is the weeks either side", () => {
    expect(neighbourWeeks(three, "2026-11-02")).toEqual({ prev: "2026-10-26", next: "2026-11-09" });
  });

  it("stops at the ends of the plan", () => {
    expect(neighbourWeeks(three, "2026-10-26")).toEqual({ prev: undefined, next: "2026-11-02" });
    expect(neighbourWeeks(three, "2026-11-09")).toEqual({ prev: "2026-11-02", next: undefined });
  });

  it("leads back into the plan from a week outside it", () => {
    expect(neighbourWeeks(three, "2026-10-05")).toEqual({ prev: undefined, next: "2026-10-26" });
    expect(neighbourWeeks(three, "2027-01-04")).toEqual({ prev: "2026-11-09", next: undefined });
  });
});

describe("planTotals", () => {
  it("sums each week's planned runs, not its lifts", () => {
    expect(planTotals(plan, [])).toEqual([{ index: 1, start: "2026-10-26", planned_m: 33000, actual_m: 0 }]);
  });

  it("sums the runs recorded inside each week", () => {
    const activities = [
      activity("2026-10-25", 9000), // the Sunday before
      activity("2026-10-27", 5000),
      activity("2026-11-01", 14000),
      activity("2026-10-28", 5000, "cycling"),
    ];
    expect(planTotals(plan, activities)[0].actual_m).toBe(19000);
  });
});

describe("activitiesBetween", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cadent-"));
  afterAll(() => rmSync(dir, { recursive: true }));

  it("is empty when the database doesn't exist", () => {
    expect(activitiesBetween("2026-10-26", "2026-11-01", path.join(dir, "missing.db"))).toEqual([]);
  });

  it("is empty when the table doesn't exist", () => {
    const file = path.join(dir, "empty.db");
    new DatabaseSync(file).close();
    expect(activitiesBetween("2026-10-26", "2026-11-01", file)).toEqual([]);
  });

  it("reads activities in the date range", () => {
    const file = path.join(dir, "cadent.db");
    const db = new DatabaseSync(file);
    db.exec(`CREATE TABLE activities (
      id TEXT PRIMARY KEY, date TEXT NOT NULL, type TEXT NOT NULL,
      distance_m INTEGER NOT NULL, duration_s INTEGER NOT NULL, avg_hr INTEGER
    )`);
    const insert = db.prepare("INSERT INTO activities VALUES (?, ?, ?, ?, ?, ?)");
    insert.run("a", "2026-10-25", "running", 9000, 3000, 150);
    insert.run("b", "2026-10-27", "running", 5000, 1800, 148);
    insert.run("c", "2026-11-01", "trail_running", 14000, 5400, null);
    db.close();

    expect(activitiesBetween("2026-10-26", "2026-11-01", file).map((a) => ({ ...a }))).toEqual([
      { id: "b", date: "2026-10-27", type: "running", distance_m: 5000, duration_s: 1800, avg_hr: 148 },
      { id: "c", date: "2026-11-01", type: "trail_running", distance_m: 14000, duration_s: 5400, avg_hr: null },
    ]);
  });
});
