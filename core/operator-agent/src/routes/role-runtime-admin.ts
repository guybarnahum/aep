import { getImplementationBindingExecutor } from "@aep/operator-agent/lib/implementation-binding-registry";
import {
  getRoleCatalogEntry,
  updateRoleRuntimeCapability,
} from "@aep/operator-agent/persistence/d1/role-catalog-store-d1";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

function jsonError(message: string, status = 400): Response {
  return Response.json({ ok: false, error: message }, { status });
}

export async function handleRoleRuntimeAdmin(
  request: Request,
  env: OperatorAgentEnv | undefined,
  roleId: string,
): Promise<Response> {
  if (!env) return jsonError("Missing operator-agent environment", 500);
  if (request.method !== "PATCH") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const role = await getRoleCatalogEntry(env, roleId);
  if (!role) return jsonError(`Unknown roleId: ${roleId}`, 404);

  const body = (await request.json()) as Record<string, unknown>;
  const runtimeEnabled = body.runtimeEnabled === true;
  const implementationBinding =
    typeof body.implementationBinding === "string" &&
    body.implementationBinding.trim().length > 0
      ? body.implementationBinding.trim()
      : null;

  if (runtimeEnabled && !implementationBinding) {
    return jsonError("implementationBinding is required when runtimeEnabled=true");
  }

  if (implementationBinding) {
    try {
      getImplementationBindingExecutor(implementationBinding);
    } catch {
      return jsonError(`Unknown implementationBinding: ${implementationBinding}`);
    }
  }

  const updated = await updateRoleRuntimeCapability(env, {
    roleId,
    runtimeEnabled,
    implementationBinding,
  });

  return Response.json({ ok: true, role: updated });
}
