import { EscalationLog } from "@aep/operator-agent/lib/escalation-log";
import { applyAcknowledged } from "@aep/operator-agent/lib/escalation-state";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleAcknowledgeEscalation(
  request: Request,
  env?: OperatorAgentEnv
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url = new URL(request.url);
  const escalationId = url.searchParams.get("id");

  if (!escalationId) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing escalation id" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const actor = request.headers.get("x-actor") ?? "operator";

  const log = new EscalationLog(env ?? {});
  const escalation = await log.get(escalationId);

  if (!escalation) {
    return new Response(
      JSON.stringify({ ok: false, error: "Escalation not found" }),
      { status: 404, headers: { "content-type": "application/json" } }
    );
  }

  let updated;
  try {
    updated = applyAcknowledged(escalation, actor);
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  await log.put(updated);

  return Response.json({ ok: true, escalation: updated });
}
