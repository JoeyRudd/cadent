/** One figure with its unit and usual value; a dash when there's nothing for it. */
export function Stat({
  value,
  unit,
  label,
  usual,
}: {
  value: string | null;
  unit?: string;
  label: string;
  usual?: string | null;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xl font-bold sm:text-2xl">
        {value ?? "–"}
        {unit && value !== null && <span className="whitespace-nowrap text-sm font-medium text-muted"> {unit}</span>}
      </p>
      <p className="text-xs text-muted">{label}</p>
      {usual != null && <p className="text-xs text-muted">{usual}</p>}
    </div>
  );
}
