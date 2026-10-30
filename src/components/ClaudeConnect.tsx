"use client";

import { useActionState } from "react";

import { disconnectClaude } from "@/app/connect/actions";
import { SECONDARY_BUTTON } from "@/components/iconButton";

// Settings › Claude: whether the connector is on and connected, and a way to sign Claude out.
export function ClaudeConnect({ mcpUrl, connected }: { mcpUrl?: string; connected: boolean }) {
  const [error, disconnectAction, disconnecting] = useActionState(disconnectClaude, undefined);

  return (
    <section className="mt-4 flex flex-col gap-3.5 rounded-card border border-line bg-surface p-4.5">
      <div>
        <h2 className="font-semibold">Claude</h2>
        <p className="text-sm text-muted">
          {!mcpUrl
            ? "Off. Set CADENT_URL and CADENT_PUBLIC_URL to let Claude read and edit your plan (docs/home-server.md)."
            : connected
              ? "Connected. Claude can read your plan and runs, and move runs or change their distance."
              : "In Claude, add a custom connector with this URL, then allow it here when Claude asks."}
        </p>
      </div>
      {mcpUrl && !connected && <p className="break-all rounded-button bg-bg px-3.5 py-3 text-sm text-ink">{mcpUrl}</p>}
      {connected && (
        <form action={disconnectAction}>
          <button
            type="submit"
            disabled={disconnecting}
            className={`${SECONDARY_BUTTON} w-full`}
          >
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-off-plan">
          {error}
        </p>
      )}
    </section>
  );
}
