import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, describe, expect, it } from "vitest";

import { detailsFor, type Activity, type Point } from "./activities";
import type { Plan, Run } from "./plan";
import { joinDetails, kmSplits, lapKinds, paceSeries, runDetail, runStats, zoneTime } from "./run";

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
      pace: undefined,
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
      pace: undefined,
    });
  });

  it("doesn't call today's partial run short", () => {
    const detail = runDetail(plan, [activity({ distance_m: 3000 })], "2026-10-27", "2026-10-27");
    expect(detail.status).toBe("upcoming");
  });

  it("has no pace for a run without distance", () => {
    expect(runDetail(plan, [activity({ distance_m: 0 })], "2026-10-27", TODAY).recorded?.pace_s_per_km).toBeNull();
  });

  it("compares pace with a target range or a single value within ±10%", () => {
    // 6200 m in 2480 s is 6:40 /km.
    const verdict = (pace_s_per_km: NonNullable<Run["pace_s_per_km"]>) => {
      const run: Run = { date: "2026-10-27", kind: "run", type: "easy", distance_m: 6000, pace_s_per_km };
      return runDetail({ ...plan, weeks: [{ ...plan.weeks[0], sessions: [run] }] }, [activity({})], "2026-10-27", TODAY)
        .pace;
    };
    expect(verdict([390, 420])).toBe("on");
    expect(verdict([420, 390])).toBe("on");
    expect(verdict([410, 440])).toBe("fast");
    expect(verdict([360, 390])).toBe("slow");
    expect(verdict(405)).toBe("on");
    expect(verdict(450)).toBe("fast");
    expect(verdict(360)).toBe("slow");
  });

  it("keeps a run on a rest day as an extra", () => {
    const detail = runDetail(plan, [activity({ date: "2026-10-29" })], "2026-10-29", TODAY);
    expect(detail.run).toBeUndefined();
    expect(detail.recorded?.distance_m).toBe(6200);
    expect(detail.status).toBe("extra");
  });
});

/** A steady run: one sample every 10 s at `speed` m/s, heart rate from `hr`, climbing 1 m a sample. */
function steady(seconds: number, speed: number, hr: (t: number) => number | null = () => 150): Point[] {
  return Array.from({ length: seconds / 10 + 1 }, (_, n) => ({
    t_s: n * 10,
    distance_m: n * 10 * speed,
    hr: hr(n * 10),
    speed_m_s: speed,
    elev_m: 100 + n,
  }));
}

describe("kmSplits", () => {
  it("splits each full kilometre and keeps the part left over", () => {
    // 2.5 km at 4 m/s: 250 s a kilometre, a 4:10 pace.
    const splits = kmSplits(steady(625, 4).slice(0, 63));
    expect(splits.map((s) => [s.km, s.distance_m, s.duration_s, s.pace_s_per_km, s.avg_hr])).toEqual([
      [1, 1000, 250, 250, 150],
      [2, 1000, 250, 250, 150],
      [3, 480, 120, 250, 150],
    ]);
    expect(splits[0].elev_change_m).toBe(25);
  });

  it("leaves a stop out of the split's time", () => {
    // 1 km, a minute standing still, then another km.
    const first = steady(250, 4);
    const second = first.slice(1).map((p) => ({ ...p, t_s: p.t_s + 310, distance_m: p.distance_m + 1000 }));
    const stopped = [...first, { ...first[first.length - 1], t_s: 310 }, ...second];
    expect(kmSplits(stopped).map((s) => s.duration_s)).toEqual([250, 250]);
  });

  it("averages heart rate over time and allows samples without it", () => {
    const splits = kmSplits(steady(250, 4, (t) => (t <= 120 ? 140 : t <= 130 ? null : 160)));
    expect(splits[0].avg_hr).toBe(150);
  });

  it("drops a last bit too short to be a split", () => {
    expect(kmSplits(steady(260, 4))).toHaveLength(1);
  });

  it("is empty without samples", () => {
    expect(kmSplits([])).toEqual([]);
  });
});

describe("zoneTime", () => {
  it("counts every second with a heart rate, in the plan's zones and the gaps between", () => {
    const points = steady(60, 3, (t) => [null, 120, 142, 150, 160, 173, 195][t / 10]);
    const zones = { z4: [173, 189], z1: [126, 142], z2: [142, 158] } satisfies Plan["zones"];
    expect(zoneTime(points, zones)).toEqual([
      { lo: 0, hi: 126, seconds: 10 },
      { zone: "z1", lo: 126, hi: 142, seconds: 0 },
      { zone: "z2", lo: 142, hi: 158, seconds: 20 },
      { lo: 158, hi: 173, seconds: 10 },
      { zone: "z4", lo: 173, hi: 189, seconds: 10 },
      { lo: 189, hi: Infinity, seconds: 10 },
    ]);
  });
});

describe("paceSeries", () => {
  it("gives pace along the run and a gap while stopped", () => {
    // 400 m at 4 m/s, then 100 s standing still.
    const points = steady(100, 4);
    const still = Array.from({ length: 10 }, (_, n) => ({ ...points[points.length - 1], t_s: 110 + n * 10 }));
    const series = paceSeries([...points, ...still]);
    expect(series[0]).toEqual([0, 250]);
    expect(series[series.length - 1]).toEqual([400, null]);
  });
});

describe("runStats", () => {
  it("takes max heart rate from samples and laps, sums climb and weights cadence by time", () => {
    const laps = [
      { distance_m: 1000, duration_s: 300, avg_hr: 150, max_hr: 170, elev_gain_m: 5, cadence_spm: 170 },
      { distance_m: 500, duration_s: 100, avg_hr: 160, max_hr: null, elev_gain_m: 3, cadence_spm: 180 },
    ];
    expect(runStats({ laps, points: steady(20, 4, () => 175) })).toEqual({ max_hr: 175, climb_m: 8, cadence_spm: 173 });
  });

  it("leaves out what Garmin didn't record", () => {
    expect(runStats({ laps: [], points: [] })).toEqual({});
  });
});

describe("lapKinds", () => {
  const lap = (distance_m: number, duration_s: number) => ({
    distance_m,
    duration_s,
    avg_hr: null,
    max_hr: null,
    elev_gain_m: null,
    cadence_spm: null,
  });

  it("names a workout's laps from their pace", () => {
    // The tempo on Oct 28: 2 km warm-up, 4 × 6 min with a minute's jog between, cool-down.
    const laps = [lap(2000, 780), lap(1057, 359), lap(141, 60), lap(1064, 360), lap(144, 60), lap(1451, 573)];
    expect(lapKinds(laps)).toEqual(["warm-up", "rep", "recovery", "rep", "recovery", "cool-down"]);
  });

  it("leaves a steady run's auto-laps unnamed", () => {
    expect(lapKinds([lap(1000, 400), lap(1000, 395), lap(1000, 405), lap(1000, 398)])).toBeUndefined();
    expect(lapKinds([lap(2000, 780), lap(1000, 340), lap(1000, 600)])).toBeUndefined();
  });
});

describe("joinDetails", () => {
  it("carries the second run on from where the first ended", () => {
    const lap = { distance_m: 1000, duration_s: 250, avg_hr: 150, max_hr: 155, elev_gain_m: 2, cadence_spm: 170 };
    const run = { laps: [lap], points: steady(20, 4) };
    const joined = joinDetails([run, run]);
    expect(joined.laps).toHaveLength(2);
    expect(joined.points.map((p) => [p.t_s, p.distance_m])).toEqual([
      [0, 0],
      [10, 40],
      [20, 80],
      [20, 80],
      [30, 120],
      [40, 160],
    ]);
  });
});

describe("detailsFor", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cadent-"));
  afterAll(() => rmSync(dir, { recursive: true }));

  it("is empty before the sync has fetched any details", () => {
    const file = path.join(dir, "empty.db");
    new DatabaseSync(file).close();
    expect(detailsFor(["a"], file).size).toBe(0);
  });

  it("reads laps and samples by activity id", () => {
    const file = path.join(dir, "cadent.db");
    const db = new DatabaseSync(file);
    db.exec("CREATE TABLE details (activity_id TEXT PRIMARY KEY, laps TEXT NOT NULL, points TEXT NOT NULL)");
    const insert = db.prepare("INSERT INTO details VALUES (?, ?, ?)");
    insert.run("a", "[[1000, 370, 148, 155, 4, 172]]", "[[5, 14, 121, 2.71, 80.0], [10, 28, null, null, null]]");
    insert.run("b", "[]", "[]");
    db.close();

    expect(detailsFor(["a", "c"], file)).toEqual(
      new Map([
        [
          "a",
          {
            laps: [{ distance_m: 1000, duration_s: 370, avg_hr: 148, max_hr: 155, elev_gain_m: 4, cadence_spm: 172 }],
            points: [
              { t_s: 5, distance_m: 14, hr: 121, speed_m_s: 2.71, elev_m: 80 },
              { t_s: 10, distance_m: 28, hr: null, speed_m_s: null, elev_m: null },
            ],
          },
        ],
      ]),
    );
  });
});
