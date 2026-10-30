import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { activitiesBetween } from "@/lib/activities";
import { checkPlan, historyRange } from "@/lib/check";
import { dayLabel } from "@/lib/format";
import { plan } from "@/lib/plan";
import type { Finding } from "@/lib/rules";

export const metadata: Metadata = { title: "Plan check · Cadent" };

type WeekFindings = { index: number; start: string; findings: Finding[] };

export default function Check() {
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <Suspense fallback={<FindingsPlaceholder />}>
        <Findings />
      </Suspense>
    </main>
  );
}

/** Empty blocks the size of the title, summary and first weeks, so the page doesn't jump when the findings stream in. */
function FindingsPlaceholder() {
  return (
    <div aria-hidden="true">
      <div className="h-14" />
      <div className="mt-6 space-y-4">
        <div className="h-28 rounded-card bg-surface" />
        <div className="h-48 rounded-card bg-surface" />
      </div>
    </div>
  );
}

// Reads Garmin history from the database, so it renders per request instead of at build time.
async function Findings() {
  await connection();
  const { from, to } = historyRange(plan);
  const findings = checkPlan(plan, activitiesBetween(from, to));
  const weeks = plan.weeks
    .map((week) => {
      const days = new Set(week.sessions.map((s) => s.date));
      return { index: week.index, start: week.start, findings: findings.filter((f) => days.has(f.day)) };
    })
    .filter((week) => week.findings.length > 0);

  return (
    <>
      <p className="text-muted">Plan check</p>
      <h1 className="mt-1 text-2xl font-semibold">{plan.name}</h1>

      <div className="mt-6 space-y-4">
        <Summary findings={findings} />
        {weeks.map((week) => (
          <Week key={week.index} week={week} />
        ))}
      </div>
    </>
  );
}

function Summary({ findings }: { findings: Finding[] }) {
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const errors = findings.length - warnings;
  const parts = [count(warnings, "warning"), count(errors, "error")].filter(Boolean);

  return (
    <section className="rounded-card bg-surface p-6">
      <p className="text-4xl font-semibold">{findings.length === 0 ? "Plan looks safe" : parts.join(", ")}</p>
      <p className="mt-2 text-muted">
        {findings.length === 0
          ? "Every run passes the safety rules."
          : "Checked against the safety rules. Errors need a change to the plan."}
      </p>
    </section>
  );
}

function Week({ week }: { week: WeekFindings }) {
  return (
    <section className="rounded-card bg-surface p-4">
      <h2 className="font-semibold">
        Week {week.index} <span className="font-normal text-muted">· {weekRange(week.start)}</span>
      </h2>
      <ul className="mt-3 space-y-3">
        {week.findings.map((finding) => (
          <FindingRow key={`${finding.day} ${finding.code}`} finding={finding} />
        ))}
      </ul>
    </section>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const error = finding.severity === "error";
  return (
    <li className="flex gap-3">
      <span
        className={`mt-1.5 size-2.5 shrink-0 rounded-full ${error ? "bg-warning" : "bg-off-plan"}`}
        aria-hidden
      />
      <div>
        <p className="text-sm font-medium">
          {dayLabel(finding.day)}{" "}
          <span
            className={`ml-1 rounded-button px-2 py-0.5 text-xs ${
              error ? "border border-warning text-warning" : "bg-off-plan-soft text-off-plan"
            }`}
          >
            {error ? "Error" : "Warning"}
          </span>
        </p>
        <p className={`mt-1 text-sm ${error ? "text-warning" : "text-muted"}`}>{finding.message}</p>
      </div>
    </li>
  );
}

/** 2, "warning" → "2 warnings"; 0 → "". */
function count(n: number, noun: string): string {
  if (n === 0) return "";
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/** "2026-10-19" → "Oct 19 – Oct 25" (plan dates are UTC midnight, like format.ts). */
function weekRange(start: string): string {
  const format = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const first = new Date(start);
  const last = new Date(first);
  last.setUTCDate(first.getUTCDate() + 6);
  return `${format.format(first)} – ${format.format(last)}`;
}
