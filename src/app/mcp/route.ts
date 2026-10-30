// Claude's connector endpoint (lib/mcp.ts). Reached from the internet through Tailscale Funnel, so
// every request needs an access token from lib/oauth.ts.

import { handle } from "@/lib/mcp";
import { connectorUrls, validToken } from "@/lib/oauth";
import { localDate } from "@/lib/plan";

export async function POST(request: Request) {
  const urls = connectorUrls();
  if (!urls) return new Response(null, { status: 404 });
  if (!validToken(request.headers.get("authorization"))) {
    return new Response(null, {
      status: 401,
      headers: { "WWW-Authenticate": `Bearer resource_metadata="${urls.issuer}/.well-known/oauth-protected-resource"` },
    });
  }
  let message: unknown;
  try {
    message = await request.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "That isn't JSON." } }, { status: 400 });
  }
  if (typeof message !== "object" || message === null || Array.isArray(message)) {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Send one JSON-RPC message." } }, { status: 400 });
  }
  const reply = handle(message, localDate(new Date()));
  return reply ? Response.json(reply) : new Response(null, { status: 202 });
}

/** Stateless: no stream for the server to send on, which the transport allows with a 405. */
export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
