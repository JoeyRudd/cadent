"use client";

import { useActionState } from "react";

import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/iconButton";
import type { AuthorizeRequest } from "@/lib/oauth";

// /connect: the owner lets Claude in, or sends it back refused. `allow` redirects to Claude on success.
export function ClaudeApprove({
  request,
  allow,
  cancel,
}: {
  request: AuthorizeRequest;
  allow: (req: AuthorizeRequest) => Promise<string | undefined>;
  cancel: string;
}) {
  const [error, allowAction, allowing] = useActionState(() => allow(request), undefined);
  return (
    <div className="flex flex-col gap-3">
      <form action={allowAction}>
        <button type="submit" disabled={allowing} className={`${PRIMARY_BUTTON} w-full`}>
          {allowing ? "Connecting…" : "Allow Claude"}
        </button>
      </form>
      <a
        href={cancel}
        className={SECONDARY_BUTTON}
      >
        Cancel
      </a>
      {error && (
        <p role="alert" className="text-sm text-off-plan">
          {error}
        </p>
      )}
    </div>
  );
}
