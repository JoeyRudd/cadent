import { useState } from "react";

/** Import screen: upload a cadent.plan/v1 file, accept every Finding, then activate the plan. */

interface Finding {
  id: string;
  rule_code: string;
  severity: "warning" | "error";
  day: string;
  week_index: number;
  message: string;
  accepted: boolean;
}

interface Imported {
  plan_id: string;
  findings: Finding[];
  skipped_lifts: number;
}

interface FieldError {
  field: string;
  message: string;
}

interface ValidationDetail {
  loc: (string | number)[];
  msg: string;
}

function post(path: string, body?: unknown): Promise<Response> {
  return fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsText(file);
  });
}

/** FastAPI's 422 detail as one entry per field, without the leading "body". */
function fieldErrors(detail: ValidationDetail[] | string): FieldError[] {
  if (typeof detail === "string") return [{ field: "file", message: detail }];
  return detail.map((d) => ({ field: d.loc.filter((p) => p !== "body").join("."), message: d.msg }));
}

/** Findings by week, in week order; within a week, Errors first, then by day. */
function byWeek(findings: Finding[]): [number, Finding[]][] {
  const weeks = new Map<number, Finding[]>();
  for (const f of findings) weeks.set(f.week_index, [...(weeks.get(f.week_index) ?? []), f]);
  const rank = (f: Finding) => (f.severity === "error" ? 0 : 1);
  return [...weeks.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, list]) => [
      week,
      list.sort((a, b) => rank(a) - rank(b) || a.day.localeCompare(b.day)),
    ]);
}

function FindingRow({ finding, onAccept }: { finding: Finding; onAccept: (confirm?: string) => void }) {
  const [typed, setTyped] = useState("");
  const isError = finding.severity === "error";
  return (
    <div className="flex flex-col gap-2 border-t border-line py-3">
      <p className={`m-0 text-sm font-semibold ${isError ? "text-warning" : "text-off-plan"}`}>
        {isError ? "Error" : "Warning"}
      </p>
      <p className="m-0 text-sm text-muted">
        {finding.day} · {finding.rule_code}
      </p>
      <p className="m-0">{finding.message}</p>
      {finding.accepted ? (
        <p className="m-0 text-sm text-on-plan">Accepted</p>
      ) : (
        <div className="flex gap-2">
          {isError && (
            <input
              aria-label={`Type ${finding.rule_code} to accept`}
              className="min-h-11 min-w-0 flex-1 rounded-button border border-line bg-surface px-3 text-ink"
              placeholder={finding.rule_code}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          )}
          <button
            type="button"
            aria-label={`Accept ${finding.severity} on ${finding.day}`}
            className="min-h-11 rounded-button border border-line bg-surface px-4 font-semibold text-ink disabled:opacity-50"
            disabled={isError && typed !== finding.rule_code}
            onClick={() => onAccept(isError ? typed : undefined)}
          >
            Accept
          </button>
        </div>
      )}
    </div>
  );
}

export function ImportPlan({ onActivated }: { onActivated: () => void }) {
  const [imported, setImported] = useState<Imported | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);

  async function upload(file: File) {
    setImported(null);
    let plan: unknown;
    try {
      plan = JSON.parse(await readText(file));
    } catch {
      setErrors([{ field: "file", message: "This file is not valid JSON." }]);
      return;
    }
    const response = await post("/plans/import", plan);
    const body: unknown = await response.json();
    if (response.ok) {
      setErrors([]);
      setImported(body as Imported);
    } else if (response.status === 422) {
      setErrors(fieldErrors((body as { detail: ValidationDetail[] | string }).detail));
    } else {
      setErrors([{ field: "file", message: `Upload failed (${response.status}).` }]);
    }
  }

  async function accept(planId: string, finding: Finding, confirm?: string) {
    const path = `/plans/${planId}/findings/${finding.id}/accept`;
    const response = await post(path, confirm === undefined ? undefined : { confirm });
    if (!response.ok) return;
    const saved = (await response.json()) as Finding;
    setImported((current) =>
      current && {
        ...current,
        findings: current.findings.map((f) => (f.id === saved.id ? saved : f)),
      },
    );
  }

  async function activate(planId: string) {
    const response = await post(`/plans/${planId}/activate`);
    if (response.ok) onActivated();
    else if (response.status === 409)
      setErrors([{ field: "plan", message: "Accept every Finding before activating." }]);
    else setErrors([{ field: "plan", message: `Activation failed (${response.status}).` }]);
  }

  const allAccepted = imported?.findings.every((f) => f.accepted) ?? false;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-5">
      <header>
        <p className="text-sm text-muted">Cadent</p>
        <h1 className="m-0 text-2xl font-bold">Import your plan</h1>
      </header>
      <label className="flex flex-col gap-2 rounded-card bg-surface p-5">
        <span className="font-semibold">Plan file (.json)</span>
        <input
          type="file"
          accept=".json,application/json"
          className="min-h-11"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </label>
      {errors.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 rounded-card bg-surface p-5 text-warning">
          {errors.map((e) => (
            <li key={e.field + e.message}>
              <code>{e.field}</code>
              <p className="m-0 text-sm">{e.message}</p>
            </li>
          ))}
        </ul>
      )}
      {imported && (
        <>
          <p className="m-0 text-muted">
            {imported.findings.length} findings · {imported.skipped_lifts} lifts not stored
          </p>
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {byWeek(imported.findings).map(([week, findings]) => (
              <li key={week} className="rounded-card bg-surface p-5">
                <h2 className="m-0 text-lg font-bold">Week {week}</h2>
                {findings.map((f) => (
                  <FindingRow
                    key={f.id}
                    finding={f}
                    onAccept={(confirm) => void accept(imported.plan_id, f, confirm)}
                  />
                ))}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="min-h-11 rounded-button bg-accent px-4 font-semibold text-on-accent disabled:opacity-50"
            disabled={!allAccepted}
            onClick={() => void activate(imported.plan_id)}
          >
            Activate
          </button>
        </>
      )}
    </main>
  );
}
