import { createStores } from "@aep/operator-agent/lib/store-factory";
import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleEscalationDetail(
  request: Request,
  env: OperatorAgentEnv,
  escalationId: string,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const escalationStore = createStores(env).escalations;
  const taskStore = getTaskStore(env);

  const escalation = await escalationStore.get(escalationId);

  if (!escalation) {
    return Response.json({ ok: false, error: "Escalation not found" }, { status: 404 });
  }

  const thread = await taskStore.findMessageThreadByEscalationId(escalationId);
  const messages = thread
    ? await taskStore.listMessages({
        threadId: thread.id,
        limit: 200,
      })
    : [];

  return Response.json({
    ok: true,
    escalation,
    thread,
    messages,
  });
}