"use client";

import { useOffline } from "next/offline";
import { useEffect } from "react";

// Tells you when the phone can't reach the server, and registers the service worker that shows an
// offline page if the installed app is opened without a connection.
export function OfflineBanner() {
  const offline = useOffline();

  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
  }, []);

  if (!offline) return null;
  return (
    <p role="status" className="bg-off-plan-soft px-4 py-2 text-center text-sm text-off-plan">
      Offline. Showing what&apos;s already loaded.
    </p>
  );
}
