// Cadent as an MCP server, so Claude (a claude.ai connector, on the owner's own subscription) can read
// the plan and runs and edit the plan. Server-only. JSON-RPC over the Streamable HTTP transport,
// stateless: every POST to /mcp is one message and gets one JSON reply. Edits go through the same
// checks as the app: moveError for moves, the safety rules for distances (changes.ts).

import { activitiesBetween, dayDetails } from "./activities";
import { changedPlan, MAX_M, MIN_M, tryChange } from "./changes";
import { checkPlan } from "./check";
import { checkInOn } from "./checkins";
import { currentPlan, tryMove } from "./moves";
import { isDay, plan, runOn } from "./plan";
import { kmSplits, lapKinds, recentRuns, runDetail, runStats, zoneTime } from "./run";
import { addDays, planTotals, weekBounds, weekOf } from "./week";
import { readinessOn, wellnessBetween } from "./wellness";

/** Protocol versions this server speaks, newest first. */
const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];

const INSTRUCTIONS =
  "Cadent is one runner's training plan for a race, with the runs Garmin recorded and overnight wellness. " +
  "Distances are metres, times seconds, paces seconds per km, dates YYYY-MM-DD in Toronto time. " +
  "Read before you suggest changes, and say what a change will do before making it. " +
  "move_run and change_run_distance enforce the plan's safety rules; never try to get around a refusal.";

type Json = Record<string, unknown>;
type Tool = {
  name: string;
  description: string;
  inputSchema: Json;
  annotations: Json;
  call: (args: Json, today: string) => unknown;
};

const day = (description: string) => ({ type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description });
const read = { readOnlyHint: true, openWorldHint: false };
const edit = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };

/** A tool's arguments failed their schema: the message goes back to Claude as a tool error. */
class BadArgs extends Error {}

/** An integer argument from 1 to `max`, or `fallback` when it's missing. */
function countArg(args: Json, name: string, max: number, fallback: number): number {
  const value = args[name];
  return Number.isInteger(value) ? Math.min(Math.max(value as number, 1), max) : fallback;
}

const MAX_RUNS = 30;
const MAX_MORNINGS = 28;

function dayArg(args: Json, name: string, fallback?: string): string {
  const value = args[name] ?? fallback;
  if (typeof value !== "string" || !isDay(value)) throw new BadArgs(`${name} must be a date as YYYY-MM-DD.`);
  return value;
}

const TOOLS: Tool[] = [
  {
    name: "get_plan_overview",
    description: "The plan's name, race, heart-rate zones, today's date, and every week's planned and run distance.",
    inputSchema: { type: "object", properties: {} },
    annotations: read,
    call: (_args, today) => {
      const current = currentPlan();
      const activities = activitiesBetween(current.weeks[0].start, today);
      return { today, name: current.name, race: current.race, zones: current.zones, weeks: planTotals(current, activities) };
    },
  },
  {
    name: "get_week",
    description:
      "One plan week, Monday to Sunday: each day's planned runs (type, distance, pace, zone, workout blocks) and lifts " +
      "next to what Garmin recorded, the day's status, and any safety-rule findings. A moved run carries planned_date.",
    inputSchema: { type: "object", properties: { date: day("Any day in the week. Defaults to today.") } },
    annotations: read,
    call: (args, today) => {
      const date = dayArg(args, "date", today);
      const current = currentPlan();
      const bounds = weekBounds(current, date);
      if (!bounds) return { error: "That day is outside the plan.", plan_starts: current.weeks[0].start };
      const findings = planFindings().filter((f) => bounds.start <= f.day && f.day <= bounds.end);
      return { today, ...weekOf(current, activitiesBetween(bounds.start, bounds.end), today, date), findings };
    },
  },
  {
    name: "get_run",
    description:
      "One day's run in detail: the plan against what Garmin recorded, km splits, laps (with warm-up/rep/recovery guesses " +
      "for workouts), time in each heart-rate zone, max HR, climb, cadence, and the runner's effort and pain check-in.",
    inputSchema: { type: "object", properties: { date: day("The day of the run.") }, required: ["date"] },
    annotations: read,
    call: (args, today) => {
      const date = dayArg(args, "date");
      const current = currentPlan();
      const activities = activitiesBetween(date, date);
      const details = dayDetails(activities);
      const kinds = details && lapKinds(details.laps);
      return {
        date,
        ...runDetail(current, activities, date, today),
        check_in: checkInOn(date) ?? null,
        ...(details && {
          stats: runStats(details),
          splits: kmSplits(details.points),
          laps: details.laps.map((lap, i) => ({ ...lap, kind: kinds?.[i] })),
          zone_time: zoneTime(details.points, current.zones),
        }),
      };
    },
  },
  {
    name: "list_recent_runs",
    description: "The most recent days with a recorded run, newest first: distance, time, pace, heart rate and status against the plan.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: MAX_RUNS, description: "How many days. Defaults to 10." } },
    },
    annotations: read,
    call: (args, today) => {
      const limit = countArg(args, "limit", MAX_RUNS, 10);
      return { today, runs: recentRuns(currentPlan(), activitiesBetween(addDays(today, -120), today), today, limit) };
    },
  },
  {
    name: "get_readiness",
    description:
      "Overnight wellness from Garmin for recent mornings (HRV and its status, sleep, resting HR), and last night " +
      "against the week before, as the Today screen shows it.",
    inputSchema: {
      type: "object",
      properties: { days: { type: "integer", minimum: 1, maximum: MAX_MORNINGS, description: "How many mornings. Defaults to 7." } },
    },
    annotations: read,
    call: (args, today) => {
      const days = countArg(args, "days", MAX_MORNINGS, 7);
      const rows = wellnessBetween(addDays(today, -Math.max(days, 8)), today);
      return { today, last_night: readinessOn(rows, today) ?? null, mornings: rows.filter((r) => r.date > addDays(today, -days)) };
    },
  },
  {
    name: "check_plan",
    description: "Every safety-rule finding for the plan as it now stands (long-run spikes over 110% of the last 30 days, runs under 5 km).",
    inputSchema: { type: "object", properties: {} },
    annotations: read,
    call: () => ({ findings: planFindings() }),
  },
  {
    name: "move_run",
    description:
      "Moves the run now on `from` to another day of the same week with no run on it. Moving it back to its planned_date " +
      "undoes the move. Returns rest-day warnings for the week, or why it couldn't move.",
    inputSchema: {
      type: "object",
      properties: { from: day("The day the run is on now."), to: day("The day to move it to.") },
      required: ["from", "to"],
    },
    annotations: edit,
    call: (args) => tryMove(dayArg(args, "from"), dayArg(args, "to")),
  },
  {
    name: "change_run_distance",
    description:
      "Sets the distance of an upcoming run, found by the day it's on now. Refused when it would break a safety rule " +
      "(for example a long run over 110% of the longest in the last 30 days). Pass reset: true to go back to the plan's distance.",
    inputSchema: {
      type: "object",
      properties: {
        date: day("The day the run is on now."),
        distance_m: { type: "integer", minimum: MIN_M, maximum: MAX_M, description: "The new distance in metres." },
        reset: { type: "boolean", description: "Put the run back to the plan's distance instead." },
      },
      required: ["date"],
    },
    annotations: edit,
    call: (args, today) => {
      const date = dayArg(args, "date");
      // The run's planned day, which changes are keyed by: it differs from `date` once the run has moved.
      const planned = runOn(currentPlan(), date)?.planned_date ?? date;
      if (args.reset !== true) return tryChange(planned, Number(args.distance_m), today, date);
      tryChange(planned, undefined, today);
      return { distance_m: runOn(plan, planned)?.distance_m };
    },
  },
];

/** The rules' findings, as the Plan check page shows them. */
function planFindings() {
  const { plan: changed, history } = changedPlan();
  return checkPlan(changed, history);
}

type Message = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Json };

/** The reply to one JSON-RPC message, or undefined for a notification, which gets none. */
export function handle(message: Message, today: string): Json | undefined {
  if (message.id === undefined || message.id === null) return undefined;
  const reply = (result: Json) => ({ jsonrpc: "2.0", id: message.id, result });
  const error = (code: number, text: string) => ({ jsonrpc: "2.0", id: message.id, error: { code, message: text } });

  switch (message.method) {
    case "initialize": {
      const asked = message.params?.protocolVersion;
      return reply({
        protocolVersion: typeof asked === "string" && VERSIONS.includes(asked) ? asked : VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: "cadent", title: "Cadent", version: "0.1.0" },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS.map(({ name, description, inputSchema, annotations }) => ({ name, description, inputSchema, annotations })) });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === message.params?.name);
      if (!tool) return error(-32602, `No tool named ${String(message.params?.name)}.`);
      try {
        const result = tool.call((message.params?.arguments ?? {}) as Json, today);
        const failed = typeof result === "object" && result !== null && "error" in result;
        return reply({ content: [{ type: "text", text: JSON.stringify(result) }], isError: failed });
      } catch (thrown) {
        if (thrown instanceof BadArgs) return reply({ content: [{ type: "text", text: thrown.message }], isError: true });
        console.error(`MCP tool ${tool.name} failed`, thrown);
        return reply({ content: [{ type: "text", text: "Cadent couldn't read its database. Try again in a moment." }], isError: true });
      }
    }
    default:
      return error(-32601, `Cadent doesn't support ${String(message.method)}.`);
  }
}
