import { createStores } from "@aep/operator-agent/lib/store-factory";
import { applyResolved } from "@aep/operator-agent/lib/escalation-state";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleResolveEscalation(
  request: Request,
  env?: OperatorAgentEnv
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: { id?: string; note?: string };
  try {
    body = (await request.json()) as { id?: string; note?: string };
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid JSON body" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const escalationId = body.id;
  const note = body.note;

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
    updated = applyResolved(escalation, actor, note);
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  await store.put(updated);

  return Response.json({ ok: true, escalation: updated });
}
