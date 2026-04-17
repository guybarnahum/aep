import { resolveAllowedScope } from "@aep/operator-agent/lib/org-scope-resolver";
import { getEmployeeCatalogEntry } from "@aep/operator-agent/persistence/d1/employee-catalog-store-d1";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleEmployeeScope(
  request: Request,
  env: OperatorAgentEnv,
  employeeId: string,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const catalogEntry = await getEmployeeCatalogEntry(env, employeeId);
  if (!catalogEntry) {
    return Response.json(
      {
        ok: false,
        error: `employee not found: ${employeeId}`,
      },
      { status: 404 },
    );
  }

  const scope = await resolveAllowedScope(env, employeeId);

  return Response.json({
    ok: true,
    employeeId,
    companyId: catalogEntry.companyId,
    teamId: catalogEntry.teamId,
    status: catalogEntry.status,
    schedulerMode: catalogEntry.schedulerMode,
    allowedTenants: scope.allowedTenants,
    allowedServices: scope.allowedServices,
    allowedEnvironmentNames: scope.allowedEnvironmentNames,
    scopeBindings: scope.bindings,
  });
}