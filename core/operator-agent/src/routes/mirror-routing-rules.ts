import { listMirrorRoutingRules } from "../persistence/d1/mirror-routing-rule-store-d1";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleMirrorRoutingRules(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json(
      { ok: false, error: "Missing operator-agent environment" },
      { status: 500 },
    );
  }

  const rules = await listMirrorRoutingRules(env);
  return Response.json({
    ok: true,
    count: rules.length,
    rules,
  });
}