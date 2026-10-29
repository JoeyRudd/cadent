import { describe, expect, it } from "vitest";

import {
  blockLabel,
  dayLabel,
  duration,
  extraLabel,
  hoursMinutes,
  km,
  pace,
  paceTarget,
  weekday,
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
    expect(zoneLabel("z2")).toBe("Zone 2");
  });

  it("formats plan dates without shifting the day", () => {
    expect(dayLabel("2026-10-27")).toBe("Tuesday, Oct 27");
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
