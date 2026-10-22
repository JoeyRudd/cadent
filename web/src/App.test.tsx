import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { App } from "./App";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("starts on the import screen", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Import your plan" })).toBeTruthy();
});

test("renders the today card once a plan is activated", async () => {
  const fetchMock = vi.fn<typeof fetch>();
  fetchMock
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ plan_id: "p1", findings: [], skipped_lifts: 0 })),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: "p1", status: "active" })));
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  const file = new File(["{}"], "plan.json", { type: "application/json" });
  fireEvent.change(screen.getByLabelText(/plan file/i), { target: { files: [file] } });
  fireEvent.click(await screen.findByRole("button", { name: "Activate" }));
  expect(await screen.findByRole("heading", { name: "Good morning" })).toBeTruthy();
  expect(screen.getByText("Today")).toBeTruthy();
});
