import { describe, expect, it } from "vitest";

import {
  blockLabel,
  clock,
  dayLabel,
  dayOfMonth,
  duration,
  extraLabel,
  hoursMinutes,
  km,
  monthShort,
  pace,
  paceTarget,
  shortDate,
  timeAndPace,
  shortDayLabel,
  weekProgress,
  weekday,
  weeksAway,
  zoneLabel,
} from "./format";

describe("units", () => {
  it("formats distance, pace and duration", () => {
    expect(km(5000)).toBe("5.0");
    expect(km(21097)).toBe("21.1");
    expect(pace(340)).toBe("5:40");
    expect(pace(305)).toBe("5:05");
    expect(duration(20)).toBe("20 s");
    expect(duration(300)).toBe("5 min");
    expect(duration(90)).toBe("1 min 30 s");
    expect(hoursMinutes(26400)).toBe("7:20");
    expect(hoursMinutes(25530)).toBe("7:06");
    expect(clock(2480)).toBe("41:20");
    expect(clock(3725)).toBe("1:02:05");
    expect(zoneLabel("z2")).toBe("Zone 2");
  });

  it("formats plan dates without shifting the day", () => {
    expect(dayLabel("2026-10-27")).toBe("Tuesday, Oct 27");
    expect(shortDayLabel("2026-10-27")).toBe("Tue, Oct 27");
    expect(weekday("2026-10-28")).toBe("Wed");
  });
});

describe("blockLabel", () => {
  it("formats reps of a duration with pace and rest", () => {
    expect(
      blockLabel({
        label: "sub-threshold",
        reps: 4,
        duration_s: 360,
        pace_s_per_km: [340, 355],
        recovery_s: 60,
      }),
    ).toEqual({ name: "Sub-threshold", detail: "4 × 6 min @ 5:40–5:55 /km, 1 min rest" });
  });

  it("formats a distance, a heart-rate ceiling, bare reps and an empty block", () => {
    expect(blockLabel({ label: "warm-up", distance_m: 2000 }).detail).toBe("2.0 km");
    expect(blockLabel({ label: "HM pace", distance_m: 3000, hr_ceiling: 184 }).detail).toBe(
      "3.0 km under 184 bpm",
    );
    expect(blockLabel({ label: "strides", reps: 2 }).detail).toBe("× 2");
    expect(blockLabel({ label: "cool-down" })).toEqual({ name: "Cool-down", detail: "" });
  });
});

describe("run pills", () => {
  it("formats a single pace target as approximate and a range as is", () => {
    expect(paceTarget(405)).toBe("~6:45 /km");
    expect(paceTarget([390, 420])).toBe("6:30–7:00 /km");
  });

  it("formats extras with a rep range, single reps or no reps", () => {
    expect(extraLabel({ type: "strides", reps: [4, 6], duration_s: 20 })).toBe("Strides 4–6 × 20 s");
    expect(extraLabel({ type: "strides", reps: 4, duration_s: 20 })).toBe("Strides 4 × 20 s");
    expect(extraLabel({ type: "strides", duration_s: 20 })).toBe("20 s strides");
  });
});

describe("timeAndPace", () => {
  it("joins time and pace, or just the time without a pace", () => {
    expect(timeAndPace(2472, 348)).toBe("41:12 · 5:48 /km");
    expect(timeAndPace(2472, null)).toBe("41:12");
  });
});

describe("week helpers", () => {
  it("formats short dates", () => {
    expect(shortDate("2026-10-26")).toBe("Oct 26");
    expect(monthShort("2026-11-02")).toBe("Nov");
    expect(dayOfMonth("2026-11-02")).toBe("2");
    expect(dayOfMonth("2026-10-28")).toBe("28");
  });

  it("says where a week stands", () => {
    const week = { start: "2026-10-26", end: "2026-11-01", planned_m: 38000, actual_m: 23400, runs_planned: 4 };
    expect(weekProgress(week, "2026-10-29")).toBe("14.6 km to go");
    expect(weekProgress({ ...week, actual_m: 38000 }, "2026-10-29")).toBe("Week's distance done");
    expect(weekProgress(week, "2026-11-03")).toBe("14.6 km under plan, that's fine");
    expect(weekProgress({ ...week, actual_m: 0 }, "2026-10-20")).toBe("Starts Mon, Oct 26");
  });

  it("says how far a week is from this one", () => {
    const now = "2026-10-26";
    expect(weeksAway("2026-10-26", now)).toBe("This week");
    expect(weeksAway("2026-10-19", now)).toBe("Last week");
    expect(weeksAway("2026-10-05", now)).toBe("3 weeks ago");
    expect(weeksAway("2026-11-02", now)).toBe("Next week");
    expect(weeksAway("2026-11-16", now)).toBe("In 3 weeks");
  });
});
