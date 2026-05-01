import { getCloudflareAccessIdentity } from "../auth/cloudflare-access";
import { resolveOperatorIdentity } from "../auth/operator-identity";
import type { AuthErrorResponse, AuthMeResponse } from "../auth/auth-types";
import type { OperatorAgentEnv } from "../types";

function jsonError(error: string, status = 401): Response {
  return Response.json({ ok: false, error } satisfies AuthErrorResponse, { status });
}

export async function handleAuthMe(
  request: Request,
  env: OperatorAgentEnv | undefined,
): Promise<Response> {
  if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  if (!env) return jsonError("Missing operator-agent environment", 500);

  const accessIdentity = getCloudflareAccessIdentity(request, env);
  if (!accessIdentity) return jsonError("Missing authenticated Cloudflare Access identity", 401);

  const operator = resolveOperatorIdentity(accessIdentity, env);
  if (!operator) return jsonError("Authenticated user is not an allowed AEP operator", 403);

  return Response.json({ ok: true, operator } satisfies AuthMeResponse);
}
