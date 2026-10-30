"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { FOCUS_RING } from "@/components/iconButton";

const TABS = [
  { href: "/", label: "Today" },
  { href: "/week", label: "Week" },
  { href: "/check", label: "Plan check" },
];

// Fixed bottom tabs, thumb-reachable on a phone. Client-side only to read the current path.
// The path isn't known while prerendering a route like /run/[date], so the bar renders without
// a highlighted tab until it streams in.
export function TabBar() {
  return (
    <Suspense fallback={<Tabs />}>
      <ActiveTabs />
    </Suspense>
  );
}

function ActiveTabs() {
  const pathname = usePathname();
  const fromWeek = useSearchParams().get("from") === "week";
  // A run belongs to the tab it was opened from.
  return <Tabs active={pathname.startsWith("/run/") ? (fromWeek ? "/week" : "/") : pathname} />;
}

function Tabs({ active }: { active?: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-surface pb-safe">
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => (
          <li key={tab.href} className="flex-1">
            <Link
              href={tab.href}
              aria-current={active === tab.href ? "page" : undefined}
              className={`flex min-h-14 items-center justify-center text-sm font-medium active:bg-bg ${FOCUS_RING}`}
            >
              <Label active={active === tab.href}>{tab.label}</Label>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Reads the link's pending state, so the tapped tab lights up before the page arrives.
function Label({ active, children }: { active: boolean; children: string }) {
  const { pending } = useLinkStatus();
  return <span className={active || pending ? "text-accent" : "text-muted"}>{children}</span>;
}
