import { describe, expect, it } from "vitest";

import { handle } from "./mcp";

describe("handle", () => {
  it("answers initialize with the version Claude asked for, if it's known", () => {
    const reply = handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, "2026-11-01");
    expect(reply).toMatchObject({ id: 1, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} } } });
    const newer = handle({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "2099-01-01" } }, "2026-11-01");
    expect(newer).toMatchObject({ result: { protocolVersion: "2025-11-25" } });
  });

  it("sends nothing back for a notification", () => {
    expect(handle({ jsonrpc: "2.0", method: "notifications/initialized" }, "2026-11-01")).toBeUndefined();
  });

  it("lists the tools, with the edits marked as writes", () => {
    const reply = handle({ jsonrpc: "2.0", id: 3, method: "tools/list" }, "2026-11-01") as {
      result: { tools: { name: string; annotations: { readOnlyHint: boolean } }[] };
    };
    const writes = reply.result.tools.filter((t) => !t.annotations.readOnlyHint).map((t) => t.name);
    expect(writes).toEqual(["move_run", "change_run_distance"]);
  });

  it("returns a bad date as a tool error, not a crash", () => {
    const reply = handle({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "get_run", arguments: { date: "soon" } } }, "2026-11-01");
    expect(reply).toMatchObject({ result: { isError: true, content: [{ text: "date must be a date as YYYY-MM-DD." }] } });
  });

  it("refuses unknown tools and methods", () => {
    expect(handle({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "delete_everything" } }, "2026-11-01")).toHaveProperty("error");
    expect(handle({ jsonrpc: "2.0", id: 6, method: "resources/list" }, "2026-11-01")).toMatchObject({ error: { code: -32601 } });
  });
});
