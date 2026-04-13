import { createStores } from "@aep/operator-agent/lib/store-factory";
import { applyAcknowledged } from "@aep/operator-agent/lib/escalation-state";
import {
  appendSystemMessage,
  ensureEscalationThread,
} from "@aep/operator-agent/lib/human-interaction-threads";
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

  const store = createStores(env ?? {}).escalations;
  const escalation = await store.get(escalationId);

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

  await store.put(updated);

  let threadId: string | undefined;

  if (env && updated) {
    threadId = await ensureEscalationThread({
      env,
      escalationId: updated.escalationId,
      companyId: updated.companyId,
      createdByEmployeeId: updated.managerEmployeeId,
      topic: `Escalation ${updated.escalationId}`,
    });

    await appendSystemMessage({
      env,
      threadId,
      companyId: updated.companyId,
      senderEmployeeId: actor,
      subject: "Escalation acknowledged",
      body: `Escalation ${updated.escalationId} was acknowledged by ${actor}.`,
      relatedEscalationId: updated.escalationId,
      type: "escalation",
    });
  }

  return Response.json({ ok: true, escalation: updated, threadId });
}
