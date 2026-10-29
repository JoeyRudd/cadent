import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, describe, expect, it } from "vitest";

import { readinessOn, wellnessBetween, type Wellness } from "./wellness";

function night(date: string, overrides: Partial<Wellness> = {}): Wellness {
  return { date, hrv_ms: 58, hrv_week_ms: 55, hrv_status: "BALANCED", sleep_s: 26400, rhr: 52, ...overrides };
}

describe("readinessOn", () => {
  it("compares last night with the 7 nights before", () => {
    const rows = [
      night("2026-10-21", { sleep_s: 1000, rhr: 90 }), // 8 nights back: left out
      night("2026-10-22", { sleep_s: 25200, rhr: 54 }),
      night("2026-10-27", { sleep_s: 25800, rhr: null }),
      night("2026-10-28", { sleep_s: null, rhr: 53 }),
      night("2026-10-29"),
    ];
    expect(readinessOn(rows, "2026-10-29")).toEqual({
      status: "BALANCED",
      hrv_ms: 58,
      hrv_week_ms: 55,
      sleep_s: 26400,
      usual_sleep_s: 25500,
      rhr: 52,
      usual_rhr: 54,
    });
  });

  it("is undefined without data for last night", () => {
    expect(readinessOn([night("2026-10-28")], "2026-10-29")).toBeUndefined();
    const empty = night("2026-10-29", { hrv_ms: null, hrv_status: null, sleep_s: null, rhr: null });
    expect(readinessOn([empty], "2026-10-29")).toBeUndefined();
  });

  it("has no status or usual values while Garmin builds a baseline", () => {
    const readiness = readinessOn([night("2026-10-29", { hrv_week_ms: null, hrv_status: "NONE" })], "2026-10-29");
    expect(readiness).toMatchObject({ status: null, hrv_week_ms: null, usual_sleep_s: null, usual_rhr: null });
  });
});

describe("wellnessBetween", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cadent-"));
  afterAll(() => rmSync(dir, { recursive: true }));

  it("is empty when the database or table doesn't exist", () => {
    expect(wellnessBetween("2026-10-22", "2026-10-29", path.join(dir, "missing.db"))).toEqual([]);
    const file = path.join(dir, "empty.db");
    new DatabaseSync(file).close();
    expect(wellnessBetween("2026-10-22", "2026-10-29", file)).toEqual([]);
  });

  it("reads wellness in the date range", () => {
    const file = path.join(dir, "cadent.db");
    const db = new DatabaseSync(file);
    db.exec(`CREATE TABLE wellness (
      date TEXT PRIMARY KEY, hrv_ms INTEGER, hrv_week_ms INTEGER, hrv_status TEXT, sleep_s INTEGER, rhr INTEGER
    )`);
    const insert = db.prepare("INSERT INTO wellness VALUES (?, ?, ?, ?, ?, ?)");
    insert.run("2026-10-21", 50, 52, "BALANCED", 25000, 55);
    insert.run("2026-10-29", 58, 55, "BALANCED", 26400, null);
    db.close();

    expect(wellnessBetween("2026-10-22", "2026-10-29", file).map((w) => ({ ...w }))).toEqual([night("2026-10-29", { rhr: null })]);
  });
});
