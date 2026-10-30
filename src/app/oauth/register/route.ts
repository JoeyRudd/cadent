// RFC 7591 client registration, for Claude's connector only (lib/oauth.ts).

import { connectorUrls, registerClient } from "@/lib/oauth";

export async function POST(request: Request) {
  if (!connectorUrls()) return new Response(null, { status: 404 });
  const body = await request.json().catch(() => undefined);
  const result = registerClient(body);
  if ("error" in result) return Response.json(result, { status: 400 });
  return Response.json(
    {
      client_id: result.client_id,
      client_id_issued_at: result.client_id_issued_at,
      client_name: result.name,
      redirect_uris: result.redirect_uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201 },
  );
}
