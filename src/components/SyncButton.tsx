"use client";

import { useActionState } from "react";

import { syncNow } from "@/app/actions";
import { ICON_BUTTON } from "@/components/iconButton";

// Round icon button beside Settings: pull from Garmin now instead of waiting for the hourly sync.
export function SyncButton() {
  const [error, sync, pending] = useActionState(syncNow, undefined);

  return (
    <form action={sync} className="relative">
      <button
        type="submit"
        aria-label={pending ? "Syncing with Garmin" : "Sync with Garmin"}
        disabled={pending}
        className={ICON_BUTTON}
      >
        <svg
          aria-hidden="true"
          className={`size-5 ${pending ? "animate-spin" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9" />
          <path d="M18.5 3v4.2h-4.2M5.5 21v-4.2h4.2" />
        </svg>
      </button>
      <p
        role="status"
        className={
          error
            ? "absolute top-full right-0 z-10 mt-2 w-56 rounded-card bg-off-plan-soft p-3 text-sm text-off-plan"
            : "sr-only"
        }
      >
        {error ?? (pending ? "Syncing with Garmin" : "")}
      </p>
    </form>
  );
}
