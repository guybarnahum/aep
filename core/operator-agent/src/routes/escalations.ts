import { EscalationLog } from "@aep/operator-agent/lib/escalation-log";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

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

  const log = new EscalationLog(env ?? {});
  const entries = await log.list(limit);

  return Response.json({
    ok: true,
    count: entries.length,
    entries,
  });
}
