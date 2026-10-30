"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { ownerError } from "@/lib/garmin";
import { checkAuthorize, connectorUrls, issueCode, revokeAll, type AuthorizeRequest } from "@/lib/oauth";

/** The owner approved Claude on /connect: sends Claude a code. The request comes from the client, so it's checked again. */
export async function allow(req: AuthorizeRequest): Promise<string | undefined> {
  const urls = connectorUrls();
  if (!urls) return "The Claude connector is off. Set CADENT_URL and CADENT_PUBLIC_URL.";
  const denied = await ownerError("Claude");
  if (denied) return denied;
  const checked = checkAuthorize(req, urls);
  if ("error" in checked) return checked.error;
  const back = new URL(req.redirect_uri!);
  back.searchParams.set("code", issueCode(req));
  if (req.state) back.searchParams.set("state", req.state);
  // Outside any try: redirect works by throwing.
  redirect(back.toString());
}

/** Settings › Claude: signs Claude out of Cadent. */
export async function disconnectClaude(): Promise<string | undefined> {
  const denied = await ownerError("Claude");
  if (denied) return denied;
  try {
    revokeAll();
  } catch (error) {
    console.error("Couldn't disconnect Claude", error);
    return "Couldn't disconnect Claude. Try again in a moment.";
  }
  refresh();
}
