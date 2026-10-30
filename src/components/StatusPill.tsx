import type { DayStatus } from "@/lib/week";

const PILLS: Partial<Record<DayStatus, { label: string; onPlan: boolean }>> = {
  done: { label: "On plan", onPlan: true },
  short: { label: "Short", onPlan: false },
  over: { label: "Over", onPlan: false },
  missed: { label: "Missed", onPlan: false },
  extra: { label: "Extra", onPlan: false },
};

/** How a day went against the plan, in words; nothing for a rest day or one still to come. */
export function StatusPill({ status }: { status: DayStatus }) {
  const pill = PILLS[status];
  if (!pill) return null;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        pill.onPlan ? "bg-on-plan-soft text-on-plan" : "bg-off-plan-soft text-off-plan"
      }`}
    >
      {pill.label}
    </span>
  );
}
