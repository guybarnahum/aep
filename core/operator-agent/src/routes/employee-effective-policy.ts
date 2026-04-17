import { createStores } from "@aep/operator-agent/lib/store-factory";
import { getEmployeeCatalogEntry } from "@aep/operator-agent/persistence/d1/employee-catalog-store-d1";
import { mergeAuthority, mergeBudget } from "@aep/operator-agent/lib/policy-merge";
import { resolveAllowedScope } from "@aep/operator-agent/lib/org-scope-resolver";
import { getEmployeeById } from "@aep/operator-agent/org/employees";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleEmployeeEffectivePolicy(
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

  const runtimeEmployee = getEmployeeById(employeeId);
  const scope = await resolveAllowedScope(env, employeeId);

  if (!runtimeEmployee) {
    return Response.json({
      ok: true,
      employeeId,
      companyId: catalogEntry.companyId,
      teamId: catalogEntry.teamId,
      status: catalogEntry.status,
      implemented: false,
      allowedTenants: scope.allowedTenants,
      allowedServices: scope.allowedServices,
      allowedEnvironmentNames: scope.allowedEnvironmentNames,
      message: "Employee exists in catalog but has no runtime implementation yet.",
    });
  }

  const control = await createStores(env).employeeControls.getEffective(
    employeeId,
    new Date().toISOString(),
  );

  const effectiveAuthority = mergeAuthority(
    runtimeEmployee.authority,
    control.authorityOverride,
  );
  const effectiveBudget = mergeBudget(
    runtimeEmployee.budget,
    control.budgetOverride,
  );

  return Response.json({
    ok: true,
    employeeId,
    companyId: catalogEntry.companyId,
    teamId: catalogEntry.teamId,
    status: catalogEntry.status,
    implemented: true,
    baseAuthority: runtimeEmployee.authority,
    baseBudget: runtimeEmployee.budget,
    effectiveAuthority: {
      ...effectiveAuthority,
      allowedTenants:
        scope.allowedTenants.length > 0
          ? scope.allowedTenants
          : effectiveAuthority.allowedTenants,
      allowedServices:
        scope.allowedServices.length > 0
          ? scope.allowedServices
          : effectiveAuthority.allowedServices,
      allowedEnvironmentNames: scope.allowedEnvironmentNames,
    },
    effectiveBudget,
    controlState: {
      state: control.state,
      blocked: control.blocked,
    },
  });
}