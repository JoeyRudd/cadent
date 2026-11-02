"use client";

import { useActionState, useState } from "react";

import { disconnectClaude } from "@/app/connect/actions";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/iconButton";

/** Where claude.ai adds a custom connector. */
const CONNECTORS = "https://claude.ai/settings/connectors";

// Settings › Claude: whether the connector is on and connected, the two steps to connect it in Claude,
// and a way to sign Claude out.
export function ClaudeConnect({ mcpUrl, connected }: { mcpUrl?: string; connected: boolean }) {
  const [error, disconnectAction, disconnecting] = useActionState(disconnectClaude, undefined);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(mcpUrl!);
      setCopied(true);
    } catch {
      // The URL is on screen to copy by hand.
    }
  }

  return (
    <section className="mt-4 flex flex-col gap-3.5 rounded-card border border-line bg-surface p-4.5">
      <div>
        <h2 className="font-semibold">Claude</h2>
        <p className="text-sm text-muted">
          {!mcpUrl
            ? "Off. Set CADENT_URL and CADENT_PUBLIC_URL to let Claude read and edit your plan (docs/home-server.md)."
            : connected
              ? "Connected. Claude can read your plan and runs, and move runs or change their distance."
              : "Use your own Claude plan to get run insights and change your plan."}
        </p>
      </div>
      {mcpUrl && !connected && (
        <>
          <ol className="flex flex-col gap-1 text-sm text-ink">
            <li>1. Copy Cadent&apos;s address.</li>
            <li>2. In Claude, choose Add custom connector, name it Cadent and paste it.</li>
            <li>3. Press Connect, then Allow Claude on the page Cadent opens.</li>
          </ol>
          <p className="break-all rounded-button bg-bg px-3.5 py-3 text-sm text-ink">{mcpUrl}</p>
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={copy} className={SECONDARY_BUTTON}>
              {copied ? "Copied" : "Copy address"}
            </button>
            <a
              href={CONNECTORS}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-center ${PRIMARY_BUTTON}`}
            >
              Open Claude
            </a>
          </div>
        </>
      )}
      {connected && (
        <form action={disconnectAction}>
          <button type="submit" disabled={disconnecting} className={`${SECONDARY_BUTTON} w-full`}>
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
