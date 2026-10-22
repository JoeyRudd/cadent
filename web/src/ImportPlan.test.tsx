import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { ImportPlan } from "./ImportPlan";

const warning = {
  id: "f1",
  rule_code: "LONG_RUN_SPIKE",
  severity: "warning",
  day: "2026-10-24",
  week_index: 16,
  message: "No runs in the previous 30 days.",
  accepted: false,
};
const error = { ...warning, id: "f2", severity: "error", day: "2026-11-14", week_index: 19 };

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function stubApi(...replies: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const r of replies) fetchMock.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function upload() {
  render(<ImportPlan onActivated={() => undefined} />);
  const file = new File(['{"schema":"cadent.plan/v1"}'], "plan.json", { type: "application/json" });
  fireEvent.change(screen.getByLabelText(/plan file/i), { target: { files: [file] } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("activate stays disabled until every finding is accepted", async () => {
  stubApi(
    reply(200, { plan_id: "p1", findings: [warning, error], skipped_lifts: 0 }),
    reply(200, { ...warning, accepted: true }),
    reply(200, { ...error, accepted: true }),
  );
  await upload();

  const activate = await screen.findByRole("button", { name: "Activate" });
  expect(activate).toHaveProperty("disabled", true);

  fireEvent.click(screen.getByRole("button", { name: "Accept warning on 2026-10-24" }));
  await screen.findByText("Accepted");
  expect(activate).toHaveProperty("disabled", true);

  const confirm = screen.getByLabelText("Type LONG_RUN_SPIKE to accept");
  const acceptError = screen.getByRole("button", { name: "Accept error on 2026-11-14" });
  fireEvent.change(confirm, { target: { value: "long_run_spike" } });
  expect(acceptError).toHaveProperty("disabled", true);
  fireEvent.change(confirm, { target: { value: "LONG_RUN_SPIKE" } });
  fireEvent.click(acceptError);

  await vi.waitFor(() => expect(activate).toHaveProperty("disabled", false));
});

test("within a week, errors are listed before warnings", async () => {
  const laterError = { ...error, day: "2026-10-25", week_index: 16 };
  stubApi(reply(200, { plan_id: "p1", findings: [warning, laterError], skipped_lifts: 0 }));
  await upload();
  await screen.findByText("Week 16");
  const labels = screen.getAllByText(/^(Error|Warning)$/).map((el) => el.textContent);
  expect(labels).toEqual(["Error", "Warning"]);
});

test("a 422 shows the failing field", async () => {
  stubApi(
    reply(422, {
      detail: [
        {
          loc: ["body", "weeks", 0, "sessions", 1, "run", "distance_m"],
          msg: "Field required",
          type: "missing",
        },
      ],
    }),
  );
  await upload();
  expect(await screen.findByText("weeks.0.sessions.1.run.distance_m")).toBeTruthy();
  expect(screen.getByText("Field required")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Activate" })).toBeNull();
});

test("only a 409 asks to accept every finding; other failures say activation failed", async () => {
  stubApi(
    reply(200, { plan_id: "p1", findings: [], skipped_lifts: 0 }),
    reply(409, { detail: "Accept every Finding before activating this plan." }),
    reply(500, {}),
  );
  await upload();
  const activate = await screen.findByRole("button", { name: "Activate" });
  fireEvent.click(activate);
  expect(await screen.findByText("Accept every Finding before activating.")).toBeTruthy();
  fireEvent.click(activate);
  expect(await screen.findByText("Activation failed (500).")).toBeTruthy();
});
