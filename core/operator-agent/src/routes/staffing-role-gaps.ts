import { detectStaffingGaps } from "@aep/operator-agent/hr/staffing-gap-detection";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleStaffingRoleGaps(
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

  return Response.json(await detectStaffingGaps(env));
}
