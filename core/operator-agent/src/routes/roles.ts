import { listRoleCatalog } from "@aep/operator-agent/lib/role-catalog-store-d1";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleRoles(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json(
      {
        ok: false,
        error: "Missing operator-agent environment",
      },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const teamId = url.searchParams.get("teamId") ?? undefined;
  const roles = await listRoleCatalog(env, { teamId });

  return Response.json({
    ok: true,
    count: roles.length,
    roles,
  });
}