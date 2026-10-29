import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { checkInOn, parseCheckIn, saveCheckIn } from "./checkins";

const dir = mkdtempSync(path.join(tmpdir(), "cadent-checkins-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describe("parseCheckIn", () => {
  it("reads the form's fields", () => {
    expect(parseCheckIn("2026-10-27", form({ effort: "4", pain: "1" }))).toEqual({
      date: "2026-10-27",
      effort: 4,
      pain: true,
    });
    expect(parseCheckIn("2026-10-27", form({ effort: "10", pain: "0" }))?.pain).toBe(false);
  });

  it("refuses anything the form shouldn't send", () => {
    const bad: [string, Record<string, string>][] = [
      ["2026-02-30", { effort: "4", pain: "0" }],
      ["2026-10-28", { effort: "0", pain: "0" }],
      ["2026-10-28", { effort: "11", pain: "0" }],
      ["2026-10-28", { effort: "4.5", pain: "0" }],
      ["2026-10-28", { effort: "", pain: "0" }],
      ["2026-10-28", { effort: "4", pain: "maybe" }],
      ["2026-10-28", { effort: "4" }],
    ];
    for (const [date, fields] of bad) expect(parseCheckIn(date, form(fields))).toBeUndefined();
  });
});

describe("check-ins", () => {
  it("reads nothing before the first save", () => {
    expect(checkInOn("2026-10-27", path.join(dir, "missing.db"))).toBeUndefined();
  });

  it("creates the file and table, then replaces the day's check-in on a re-save", () => {
    const file = path.join(dir, "nested", "cadent.db");
    saveCheckIn({ date: "2026-10-27", effort: 3, pain: false }, file);
    expect(checkInOn("2026-10-27", file)).toEqual({ date: "2026-10-27", effort: 3, pain: false });

    saveCheckIn({ date: "2026-10-27", effort: 7, pain: true }, file);
    expect(checkInOn("2026-10-27", file)).toEqual({ date: "2026-10-27", effort: 7, pain: true });
    expect(checkInOn("2026-10-28", file)).toBeUndefined();
  });

  it("refuses an effort outside 1–10", () => {
    expect(() => saveCheckIn({ date: "2026-10-27", effort: 11, pain: false }, path.join(dir, "cadent.db"))).toThrow();
  });
});
