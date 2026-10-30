"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { visit } from "@/lib/navigation";

/** Away this long, the pages kept on this phone are probably behind the hourly Garmin sync. */
const STALE_MS = 5 * 60 * 1000;

// Renders nothing. Two jobs: coming back to the app after a while re-reads the page you're on
// (the content stays up while it loads), and every page change is noted for BackLink.
export function RefreshOnReturn() {
  const router = useRouter();
  const path = usePathname();
  const query = useSearchParams().toString();

  useEffect(() => visit(query ? `${path}?${query}` : path), [path, query]);

  useEffect(() => {
    let hiddenAt = 0;
    const onChange = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt >= STALE_MS) router.refresh();
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [router]);

  return null;
}
