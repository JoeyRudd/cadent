// RFC 8414: where Claude registers, sends the owner to approve, and trades codes for tokens (lib/oauth.ts).
// /connect is on the tailnet URL, not the public one: only the owner's devices can open it.

import { connection } from "next/server";

import { connectorUrls } from "@/lib/oauth";

export async function GET() {
  // The URLs come from the environment at run time, not at build.
  await connection();
  const urls = connectorUrls();
  if (!urls) return new Response(null, { status: 404 });
  return Response.json({
    issuer: urls.issuer,
    authorization_endpoint: urls.authorize,
    token_endpoint: `${urls.issuer}/oauth/token`,
    registration_endpoint: `${urls.issuer}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  });
}
