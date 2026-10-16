import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { App } from "./App";

test("renders the today card", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Good morning" })).toBeTruthy();
  expect(screen.getByText("Today")).toBeTruthy();
});
