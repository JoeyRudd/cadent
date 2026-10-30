import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { ClaudeApprove } from "@/components/ClaudeApprove";
import { ownerError } from "@/lib/garmin";
import { checkAuthorize, connectorUrls, type AuthorizeRequest } from "@/lib/oauth";

import { allow } from "./actions";

export const metadata: Metadata = { title: "Connect Claude · Cadent" };

const FIELDS = ["response_type", "client_id", "redirect_uri", "code_challenge", "code_challenge_method", "resource", "state"] as const;

// Claude's OAuth authorization endpoint (lib/oauth.ts). On the tailnet URL only, so the owner's
// Tailscale login is on the request.
export default function Connect({ searchParams }: PageProps<"/connect">) {
  return (
    <main className="mx-auto max-w-md px-5 py-7">
      <Suspense fallback={<div aria-hidden="true" className="h-64 rounded-card bg-surface" />}>
        <Approval searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// Reads the request and the database, so it renders per request instead of at build time.
async function Approval({ searchParams }: Pick<PageProps<"/connect">, "searchParams">) {
  await connection();
  const params = await searchParams;
  const request: AuthorizeRequest = Object.fromEntries(
    FIELDS.flatMap((f) => (typeof params[f] === "string" ? [[f, params[f]]] : [])),
  );
  const urls = connectorUrls();
  const checked = urls ? checkAuthorize(request, urls) : { error: "The Claude connector is off." };
  const problem = "error" in checked ? checked.error : await ownerError("Claude");
  // Only built once checkAuthorize matched redirect_uri to Claude's registered callback.
  const cancel = problem ? undefined : new URL(request.redirect_uri!);
  cancel?.searchParams.set("error", "access_denied");
  if (request.state) cancel?.searchParams.set("state", request.state);

  return (
    <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4.5">
      <div>
        <h1 className="text-xl font-bold">Connect Claude</h1>
        <p className="mt-1 text-sm text-muted">
          Claude will use your own Claude plan to read your training plan, runs and sleep, and to move runs or change
          their distance. The plan&apos;s safety rules still apply to every change.
        </p>
      </div>
      {problem || !cancel ? (
        <p role="alert" className="text-sm text-off-plan">
          {problem}
        </p>
      ) : (
        <>
          <p className="text-sm text-ink">
            Sends you back to <span className="font-semibold">{cancel.host}</span>.
          </p>
          <ClaudeApprove request={request} allow={allow} cancel={cancel.toString()} />
        </>
      )}
    </section>
  );
}
