"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  return <Tabs pathname={usePathname()} />;
}

function Tabs({ pathname }: { pathname?: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-surface">
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 items-center justify-center text-sm font-medium ${FOCUS_RING} ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
