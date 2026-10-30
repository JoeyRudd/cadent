"use client";

import { useActionState } from "react";

import { connect, disconnect } from "@/app/settings/actions";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/iconButton";

const FIELD = "h-12 rounded-button border border-line bg-bg px-3.5 text-base text-ink";

// Settings › Garmin: who's connected, or a one-time login (then Garmin's code, if it asks).
// `account` is undefined until Garmin is connected here.
export function GarminConnect({ account }: { account?: { name?: string } }) {
  const [state, connectAction, connecting] = useActionState(connect, {});
  const mfa = state.step === "mfa";
  const [disconnectError, disconnectAction, disconnecting] = useActionState(disconnect, undefined);
  const error = account ? disconnectError : state.error;

  return (
    <section className="mt-4 flex flex-col gap-3.5 rounded-card border border-line bg-surface p-4.5">
      <div>
        <h2 className="font-semibold">Garmin</h2>
        <p className="text-sm text-muted">
          {account
            ? `Connected${account.name ? ` as ${account.name}` : ""}. Runs and sleep sync from Garmin Connect.`
            : "Sign in once. Cadent keeps Garmin's sign-in token, never your password."}
        </p>
      </div>

      {account ? (
        <form action={disconnectAction}>
          <button
            type="submit"
            disabled={disconnecting}
            className={`${SECONDARY_BUTTON} w-full`}
          >
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
        </form>
      ) : (
        <form action={connectAction} className="flex flex-col gap-3">
          {mfa ? (
            <label className="flex flex-col gap-1.5 text-sm">
              Garmin sent you a code
              <input
                name="code"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                className={FIELD}
              />
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1.5 text-sm">
                Email
                <input name="email" type="email" required autoComplete="username" className={FIELD} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                Password
                <input name="password" type="password" required autoComplete="current-password" className={FIELD} />
              </label>
            </>
          )}
          <button type="submit" disabled={connecting} className={PRIMARY_BUTTON}>
            {connecting ? (mfa ? "Checking…" : "Connecting…") : mfa ? "Verify" : "Connect Garmin"}
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
