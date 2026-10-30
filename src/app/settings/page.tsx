import { connection } from "next/server";
import { Suspense } from "react";

import { AppearancePicker } from "@/components/AppearancePicker";
import { BackLink } from "@/components/BackLink";
import { GarminConnect } from "@/components/GarminConnect";
import { ICON_BUTTON } from "@/components/iconButton";
import { garminAccount } from "@/lib/garmin";

export default function Settings() {
  return (
    <main className="mx-auto max-w-md px-5 py-7">
      <header className="flex items-center gap-3">
        <BackLink href="/" label="Back to Today" className={ICON_BUTTON}>
          <svg
            aria-hidden="true"
            className="size-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </BackLink>
        <h1 className="text-2xl font-bold">Settings</h1>
      </header>

      <section className="mt-4 flex flex-col gap-3.5 rounded-card border border-line bg-surface p-4.5">
        <div>
          <h2 className="font-semibold">Appearance</h2>
          <p className="text-sm text-muted">System follows your phone&apos;s light or dark mode.</p>
        </div>
        <AppearancePicker />
      </section>

      <Suspense fallback={<div aria-hidden="true" className="mt-4 h-48 rounded-card bg-surface" />}>
        <Garmin />
      </Suspense>
    </main>
  );
}

// Reads the saved token, so it renders per request instead of at build time.
async function Garmin() {
  await connection();
  const account = garminAccount();
  // Keyed so connecting or disconnecting starts the form fresh.
  return <GarminConnect key={account ? "connected" : "disconnected"} account={account} />;
}
