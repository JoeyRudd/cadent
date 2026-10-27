// Rules-engine tests, ported from cadent-v1 core/tests/test_rules.py.
// PROTECTED: change only when expected behaviour changes (see CLAUDE.md).

import { describe, expect, it } from "vitest";

import type { Run, RunType } from "./plan";
import { LONG_RUN_SPIKE, MAX_RATIO, MIN_RUN, WINDOW_DAYS, validate } from "./rules";

const DAY0 = "2026-10-12";

/** DAY0 plus `offset` days, as "YYYY-MM-DD". */
function dayAt(offset: number): string {
  const d = new Date(DAY0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function run(day: number, km: number, type: RunType = "easy"): Run {
  return { date: dayAt(day), kind: "run", type, distance_m: Math.round(km * 1000) };
}

function codes(runs: Run[], history: Run[] = []): string[] {
  return validate(runs, history).map((f) => f.code);
}

describe("LONG_RUN_SPIKE: a long run may be at most 110% of the longest run in the previous 30 days", () => {
  it("passes a long run within ten percent", () => {
    const history = [run(-7, 14, "long")];
    expect(codes([run(0, 15.4, "long")], history)).not.toContain(LONG_RUN_SPIKE);
  });

  it("makes a long run over ten percent an error", () => {
    const history = [run(-7, 14, "long")];
    const findings = validate([run(0, 15.5, "long")], history);
    const spike = findings.filter((f) => f.code === LONG_RUN_SPIKE);
    expect(spike).toHaveLength(1);
    expect(spike[0].severity).toBe("error");
    expect(spike[0].day).toBe(DAY0);
  });

  it("does not count runs older than thirty days as a baseline", () => {
    const history = [run(-31, 20, "long"), run(-7, 10, "long")];
    expect(codes([run(0, 12, "long")], history)).toContain(LONG_RUN_SPIKE);
  });

  it("counts earlier planned runs toward the baseline", () => {
    const plan = [run(0, 14, "long"), run(7, 15, "long"), run(14, 16.5, "long")];
    expect(codes(plan, [run(-7, 13, "long")])).not.toContain(LONG_RUN_SPIKE);
  });

  it("catches a jump inside the plan", () => {
    const plan = [run(0, 14, "long"), run(7, 18, "long")];
    expect(codes(plan, [run(-7, 14, "long")])).toContain(LONG_RUN_SPIKE);
  });

  it("makes a long run with no recent runs a warning, not a pass", () => {
    const findings = validate([run(0, 10, "long")], []);
    const spike = findings.filter((f) => f.code === LONG_RUN_SPIKE);
    expect(spike).toHaveLength(1);
    expect(spike[0].severity).toBe("warning");
  });

  it("does not check easy runs", () => {
    expect(codes([run(0, 12)], [run(-7, 6)])).not.toContain(LONG_RUN_SPIKE);
  });
});

describe("MIN_RUN: no run under 5 km, except a race-week shakeout", () => {
  it("makes a run under five km a warning", () => {
    const findings = validate([run(0, 4.5)], []);
    expect(findings.map((f) => [f.code, f.severity])).toEqual([[MIN_RUN, "warning"]]);
  });

  it("passes five km exactly", () => {
    expect(codes([run(0, 5)])).toEqual([]);
  });

  it("exempts a shakeout from the minimum", () => {
    expect(codes([run(0, 3, "shakeout")])).toEqual([]);
  });
});

describe("engine", () => {
  it("sorts findings by day", () => {
    const plan = [run(7, 3), run(0, 4)];
    expect(validate(plan, []).map((f) => f.day)).toEqual([DAY0, dayAt(7)]);
  });

  it("keeps the v1 message wording", () => {
    expect(validate([run(0, 4.5)], [])[0].message).toBe("Run of 4.5 km is under the 5 km minimum.");
    expect(validate([run(0, 15.5, "long")], [run(-7, 14, "long")])[0].message).toBe(
      "Long run of 15.5 km is over the 15.4 km limit (110% of the longest run in 30 days).",
    );
    expect(validate([run(0, 10, "long")], [])[0].message).toBe(
      "No runs in the previous 30 days to compare this long run against.",
    );
  });
});

// Golden fixture: Joey's real Toronto Half plan. Weeks 14-15 (Oct 5-18) as history,
// Weeks 16-20 (Oct 19 - Nov 22) as the plan under test. Day 0 is Mon Oct 12.
const L = "long";
const TORONTO_HALF_HISTORY = [
  run(-6, 5), run(-5, 6), run(-4, 5), run(-2, 10, L), // Week 14 (cutback)
  run(1, 7), run(2, 7), run(3, 6), run(5, 14, L), // Week 15
];
const TORONTO_HALF_PLAN = [
  run(8, 7), run(9, 8), run(10, 6), run(12, 15, L), // Week 16
  run(15, 5), run(16, 7), run(17, 6), run(19, 15, L), run(20, 5), // Week 17: 5th run day
  run(22, 5), run(23, 5), run(24, 5), run(26, 12, L), run(27, 5), // Week 18 (cutback)
  run(29, 6), run(30, 7), run(31, 6), run(33, 16, L), run(34, 5), // Week 19
  run(36, 6), run(37, 7), run(38, 7), run(40, 17, L), run(41, 6), // Week 20
];

describe("golden fixture", () => {
  it("finds Toronto Half weeks 16 to 20 clean", () => {
    expect(validate(TORONTO_HALF_PLAN, TORONTO_HALF_HISTORY)).toEqual([]);
  });
});

// Property-style checks (v1 used Hypothesis): random plans from a seeded generator, no new dependency.
const TYPES: RunType[] = ["easy", "long", "tempo", "intervals", "recovery", "shakeout", "race"];

function randomPlans(count: number): Run[][] {
  let seed = 42;
  const next = (max: number) => {
    seed = (seed * 48271) % 2147483647; // Park-Miller, exact in a double
    return seed % (max + 1);
  };
  return Array.from({ length: count }, () =>
    Array.from({ length: next(40) }, () => ({
      date: dayAt(next(120)),
      kind: "run" as const,
      type: TYPES[next(TYPES.length - 1)],
      distance_m: 1000 + next(34000),
    })),
  );
}

describe("properties", () => {
  const plans = randomPlans(300);

  it("accepts no long run over the spike limit", () => {
    for (const runs of plans) {
      const flagged = new Set(validate(runs, []).filter((f) => f.code === LONG_RUN_SPIKE).map((f) => f.day));
      for (const longRun of runs.filter((r) => r.type === "long" && !flagged.has(r.date))) {
        const window = runs
          .filter((r) => {
            const gap = (Date.parse(longRun.date) - Date.parse(r.date)) / 86_400_000;
            return r !== longRun && gap > 0 && gap <= WINDOW_DAYS;
          })
          .map((r) => r.distance_m);
        expect(window.length).toBeGreaterThan(0);
        expect(longRun.distance_m).toBeLessThanOrEqual(MAX_RATIO * Math.max(...window));
      }
    }
  });

  it("only reports planned days, sorted, with a severity", () => {
    for (const runs of plans) {
      const days = new Set(runs.map((r) => r.date));
      const findings = validate(runs, []);
      for (const f of findings) {
        expect(days.has(f.day)).toBe(true);
        expect(["warning", "error"]).toContain(f.severity);
      }
      const keys = findings.map((f) => `${f.day} ${f.code}`);
      expect(keys).toEqual([...keys].sort());
      expect(validate([...runs], [])).toEqual(findings);
    }
  });
});
