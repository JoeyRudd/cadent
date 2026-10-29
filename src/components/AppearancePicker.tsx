"use client";

import { useSyncExternalStore } from "react";

import { currentTheme, setTheme, subscribeTheme, type Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

// System, Light or Dark as one segmented control. Client-side only to read and save the choice.
export function AppearancePicker() {
  // The server can't see the saved choice, so it renders System and the browser corrects it.
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => "system" as const);

  return (
    <fieldset className="grid grid-cols-3 gap-1 rounded-button bg-bg p-1">
      <legend className="sr-only">Appearance</legend>
      {OPTIONS.map((option) => {
        const selected = theme === option.value;
        return (
          // Native radios, visually hidden: one tab stop and arrow keys for free.
          <label
            key={option.value}
            className={`flex h-11 cursor-pointer items-center justify-center rounded-button text-sm font-semibold has-focus-visible:outline-2 has-focus-visible:outline-accent ${
              selected ? "bg-accent text-on-accent" : "text-muted"
            }`}
          >
            <input
              type="radio"
              name="appearance"
              value={option.value}
              checked={selected}
              onChange={() => setTheme(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </fieldset>
  );
}
