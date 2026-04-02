import { createStores } from "@aep/operator-agent/lib/store-factory";
import type { EscalationState, OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleEscalations(
  request: Request,
  env?: OperatorAgentEnv
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = Math.max(
    1,
    Math.min(100, limitParam ? Number(limitParam) || 20 : 20)
  );
  const stateParam = url.searchParams.get("state") as EscalationState | null;
  const validStates: EscalationState[] = ["open", "acknowledged", "resolved"];
  const stateFilter =
    stateParam && validStates.includes(stateParam) ? stateParam : undefined;

  const store = createStores(env ?? {}).escalations;
  const entries = await store.list(limit, stateFilter);

  return Response.json({
    ok: true,
    count: entries.length,
    entries,
  });
}
