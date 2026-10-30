// RFC 9728: tells Claude which authorization server issues tokens for /mcp (lib/oauth.ts).

import { connection } from "next/server";

import { connectorUrls } from "@/lib/oauth";

export async function GET() {
  // The URLs come from the environment at run time, not at build.
  await connection();
  const urls = connectorUrls();
  if (!urls) return new Response(null, { status: 404 });
  return Response.json({ resource: urls.mcp, authorization_servers: [urls.issuer], bearer_methods_supported: ["header"] });
}
