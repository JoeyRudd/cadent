"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { cameFrom } from "@/lib/navigation";

// A Back link. When the page it leads to is the one you just came from it steps back through
// history, which restores that page's scroll position; otherwise (a direct visit, a shared link)
// it is an ordinary link to `href`.
export function BackLink({ href, label, className, children }: { href: string; label: string; className: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      aria-label={label}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !cameFrom(href)) return;
        e.preventDefault();
        router.back();
      }}
    >
      {children}
    </Link>
  );
}
