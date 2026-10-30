import { Stat } from "@/components/Stat";
import { hoursMinutes } from "@/lib/format";
import type { HrvStatus, Readiness as ReadinessData } from "@/lib/wellness";

// Garmin's HRV status, said plainly. Only balanced is a clear go; the rest are gentle, not warnings.
const BADGES: Record<HrvStatus, { label: string; className: string }> = {
  BALANCED: { label: "Good to go", className: "bg-on-plan-soft text-on-plan" },
  UNBALANCED: { label: "HRV unbalanced", className: "bg-off-plan-soft text-off-plan" },
  LOW: { label: "HRV low", className: "bg-off-plan-soft text-off-plan" },
  POOR: { label: "HRV poor", className: "bg-off-plan-soft text-off-plan" },
};

// Last night from Garmin: HRV, sleep and resting heart rate, each against its usual.
export function Readiness({ readiness }: { readiness: ReadinessData }) {
  const { status, hrv_ms, hrv_week_ms, sleep_s, usual_sleep_s, rhr, usual_rhr } = readiness;
  const badge = status && BADGES[status];

  return (
    <section className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-4.5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Readiness</h2>
        {badge && (
          <p className={`rounded-full px-2.5 py-1 text-sm font-semibold ${badge.className}`}>{badge.label}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat
          value={hrv_ms === null ? null : String(hrv_ms)}
          unit="ms"
          label="Overnight HRV"
          usual={hrv_week_ms === null ? null : `7-day avg ${hrv_week_ms}`}
        />
        <Stat
          value={sleep_s === null ? null : hoursMinutes(sleep_s)}
          label="Sleep"
          usual={usual_sleep_s === null ? null : `usual ${hoursMinutes(usual_sleep_s)}`}
        />
        <Stat
          value={rhr === null ? null : String(rhr)}
          unit="bpm"
          label="Resting HR"
          usual={usual_rhr === null ? null : `usual ${usual_rhr}`}
        />
      </div>
    </section>
  );
}
