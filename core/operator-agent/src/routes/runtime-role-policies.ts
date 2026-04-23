import { getRoleCatalogEntry } from "@aep/operator-agent/persistence/d1/role-catalog-store-d1";
import {
  getRuntimeRolePolicy,
  listRuntimeRolePolicies,
  upsertRuntimeRolePolicy,
  validateRuntimeRolePolicyInput,
} from "@aep/operator-agent/persistence/d1/runtime-role-policy-store-d1";
import type {
  AgentAuthority,
  AgentBudget,
  EscalationPolicy,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

type UpdateRuntimeRolePolicyBody = {
  authority?: AgentAuthority;
  budget?: AgentBudget;
  escalation?: EscalationPolicy;
  updatedBy?: string;
  reason?: string;
};

function requireEnv(env?: OperatorAgentEnv): OperatorAgentEnv {
  if (!env) {
    throw new Error("Missing operator-agent environment");
  }

  return env;
}

async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Request body must be valid JSON");
  }
}

function jsonError(error: unknown, status = 400): Response {
  return Response.json(
    {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    },
    { status },
  );
}

export async function handleRuntimeRolePolicies(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const resolvedEnv = requireEnv(env);
    const policies = await listRuntimeRolePolicies(resolvedEnv);

    return Response.json({
      ok: true,
      count: policies.length,
      policies,
    });
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function handleRuntimeRolePolicyDetail(
  request: Request,
  env: OperatorAgentEnv | undefined,
  roleId: string,
): Promise<Response> {
  try {
    const resolvedEnv = requireEnv(env);

    if (request.method === "GET") {
      const policy = await getRuntimeRolePolicy(resolvedEnv, roleId);
      if (!policy) {
        return jsonError(`runtime role policy not found: ${roleId}`, 404);
      }

      return Response.json({
        ok: true,
        policy,
      });
    }

    if (request.method === "PATCH" || request.method === "PUT") {
      const role = await getRoleCatalogEntry(resolvedEnv, roleId);
      if (!role) {
        return jsonError(`Unknown roleId: ${roleId}`, 404);
      }
      if (role.runtimeEnabled !== true) {
        return jsonError(
          `Role ${roleId} is not runtime_enabled; refusing runtime policy update`,
          409,
        );
      }

      const existing = await getRuntimeRolePolicy(resolvedEnv, roleId);
      const body = await readJsonBody<UpdateRuntimeRolePolicyBody>(request);

      const authority = body.authority ?? existing?.authority;
      const budget = body.budget ?? existing?.budget;
      const escalation = body.escalation ?? existing?.escalation;

      if (!authority || !budget || !escalation) {
        return jsonError(
          `Runtime role policy ${roleId} requires authority, budget, and escalation`,
          400,
        );
      }

      const next = validateRuntimeRolePolicyInput({
        roleId,
        authority,
        budget,
        escalation,
        updatedBy: body.updatedBy,
        reason: body.reason,
      });

      const policy = await upsertRuntimeRolePolicy(resolvedEnv, next);

      return Response.json({
        ok: true,
        policy,
      });
    }

    return new Response("Method Not Allowed", { status: 405 });
  } catch (error) {
    return jsonError(error, 400);
  }
}