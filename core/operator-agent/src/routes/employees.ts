import { createStores } from "@aep/operator-agent/lib/store-factory";
import { listEmployeeCatalog } from "@aep/operator-agent/lib/employee-catalog-store-d1";
import { resolveAllowedScope } from "@aep/operator-agent/lib/org-scope-resolver";
import {
  mergeAuthority,
  mergeBudget,
} from "@aep/operator-agent/lib/policy-merge";
import { getEmployeeById } from "@aep/operator-agent/org/employees";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleEmployees(
  request: Request,
  env?: OperatorAgentEnv
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
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId") ?? undefined;
  const teamId = url.searchParams.get("teamId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;

  const store = createStores(env).employeeControls;
  const catalogEntries = await listEmployeeCatalog(env, {
    companyId,
    teamId,
    status,
  });

  const employees = await Promise.all(
    catalogEntries.map(async (catalogEntry) => {
      const runtimeEmployee = getEmployeeById(catalogEntry.employeeId);
      const scope = await resolveAllowedScope(env, catalogEntry.employeeId);

      if (!runtimeEmployee) {
        return {
          identity: {
            employeeId: catalogEntry.employeeId,
            employeeName: catalogEntry.employeeName,
            companyId: catalogEntry.companyId,
            teamId: catalogEntry.teamId,
            roleId: catalogEntry.roleId,
          },
          catalog: {
            companyId: catalogEntry.companyId,
            teamId: catalogEntry.teamId,
            status: catalogEntry.status,
            schedulerMode: catalogEntry.schedulerMode,
            implemented: false,
          },
          scope: {
            allowedTenants: scope.allowedTenants,
            allowedServices: scope.allowedServices,
            allowedEnvironmentNames: scope.allowedEnvironmentNames,
          },
          message: "Employee exists in catalog but is not implemented yet.",
        };
      }

      const control = await store.getEffective(
        catalogEntry.employeeId,
        new Date().toISOString()
      );

      const effectiveAuthority = mergeAuthority(
        runtimeEmployee.authority,
        control.authorityOverride
      );

      const effectiveBudget = mergeBudget(
        runtimeEmployee.budget,
        control.budgetOverride
      );

      return {
        identity: runtimeEmployee.identity,
        catalog: {
          companyId: catalogEntry.companyId,
          teamId: catalogEntry.teamId,
          status: catalogEntry.status,
          schedulerMode: catalogEntry.schedulerMode,
          implemented: true,
        },
        authority: runtimeEmployee.authority,
        budget: runtimeEmployee.budget,
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
        escalation: runtimeEmployee.escalation,
        effectiveState: {
          state: control.state,
          blocked: control.blocked,
        },
        scope: {
          allowedTenants: scope.allowedTenants,
          allowedServices: scope.allowedServices,
          allowedEnvironmentNames: scope.allowedEnvironmentNames,
        },
        governance: {
          companyPrimaryEntryPoint: "/agent/run",
          cronFallbackEnabled: true,
          escalationRoute: "/agent/escalations",
          controlHistoryRoute: `/agent/control-history?employeeId=${catalogEntry.employeeId}`,
        },
      };
    }),
  );

  return Response.json({
    ok: true,
    count: employees.length,
    employees,
  });
}
