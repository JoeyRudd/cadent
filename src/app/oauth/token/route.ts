// The OAuth token endpoint: codes and refresh tokens for access tokens (lib/oauth.ts).

import { connectorUrls, exchange } from "@/lib/oauth";

export async function POST(request: Request) {
  const urls = connectorUrls();
  if (!urls) return new Response(null, { status: 404 });
  const form = new URLSearchParams(await request.text());
  const result = exchange(form, urls);
  // Tokens must never sit in a cache (RFC 6749 §5.1).
  const headers = { "Cache-Control": "no-store" };
  return "error" in result ? Response.json(result, { status: 400, headers }) : Response.json(result, { headers });
}
