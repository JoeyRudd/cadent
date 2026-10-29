import Link from "next/link";

import { AppearancePicker } from "@/components/AppearancePicker";
import { ICON_BUTTON } from "@/components/iconButton";

export default function Settings() {
  return (
    <main className="mx-auto max-w-md px-5 py-7">
      <header className="flex items-center gap-3">
        <Link href="/" aria-label="Back to Today" className={ICON_BUTTON}>
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
        </Link>
        <h1 className="text-2xl font-bold">Settings</h1>
      </header>

      <section className="mt-4 flex flex-col gap-3.5 rounded-card border border-line bg-surface p-4.5">
        <div>
          <h2 className="font-semibold">Appearance</h2>
          <p className="text-sm text-muted">System follows your phone&apos;s light or dark mode.</p>
        </div>
        <AppearancePicker />
      </section>
    </main>
  );
}
