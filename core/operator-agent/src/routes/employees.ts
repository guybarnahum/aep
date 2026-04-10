import { createStores } from "@aep/operator-agent/lib/store-factory";
import { listEmployeeCatalog } from "@aep/operator-agent/lib/employee-catalog-store-d1";
import { resolveAllowedScope } from "@aep/operator-agent/lib/org-scope-resolver";
import {
  mergeAuthority,
  mergeBudget,
} from "@aep/operator-agent/lib/policy-merge";
import {
  COMPANY_INTERNAL_AEP,
  type CompanyId,
} from "@aep/operator-agent/org/company";
import {
  TEAM_INFRA,
  TEAM_VALIDATION,
  TEAM_WEB_PRODUCT,
  type TeamId,
} from "@aep/operator-agent/org/teams";
import { getEmployeeById } from "@aep/operator-agent/org/employees";
import type {
  AgentRoleId,
  EmployeeProjection,
  EmployeeRuntimeStatus,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

function toCompanyId(companyId: string): CompanyId {
  if (companyId !== COMPANY_INTERNAL_AEP) {
    throw new Error(`Unsupported companyId in employee catalog: ${companyId}`);
  }
  return companyId;
}

function toTeamId(teamId: string): TeamId {
  const validTeams: TeamId[] = [
    TEAM_INFRA,
    TEAM_WEB_PRODUCT,
    TEAM_VALIDATION,
  ];

  if (!validTeams.includes(teamId as TeamId)) {
    throw new Error(`Unsupported teamId in employee catalog: ${teamId}`);
  }

  return teamId as TeamId;
}

function toAgentRoleId(roleId: string): AgentRoleId {
  const validRoles: AgentRoleId[] = [
    "timeout-recovery-operator",
    "infra-ops-manager",
    "retry-supervisor",
    "teardown-safety-operator",
    "incident-triage-operator",
    "product-manager",
    "product-manager-web",
    "frontend-engineer",
    "validation-pm",
    "validation-engineer",
    "reliability-engineer",
  ];

  if (!validRoles.includes(roleId as AgentRoleId)) {
    throw new Error(`Unsupported roleId in employee catalog: ${roleId}`);
  }

  return roleId as AgentRoleId;
}

function parseSkillsJson(skillsJson?: string): string[] | undefined {
  if (!skillsJson) return undefined;

  try {
    const parsed = JSON.parse(skillsJson);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : undefined;
  } catch {
    return undefined;
  }
}

function getRuntimeStatus(args: {
  catalogStatus: string;
  hasRuntimeEmployee: boolean;
}): EmployeeRuntimeStatus {
  if (args.catalogStatus === "planned") {
    return "planned";
  }

  if (args.catalogStatus === "disabled") {
    return "disabled";
  }

  return args.hasRuntimeEmployee ? "implemented" : "disabled";
}

export async function handleEmployees(
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
  const companyId = url.searchParams.get("companyId") ?? undefined;
  const teamId = url.searchParams.get("teamId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;

  const store = createStores(env).employeeControls;
  const catalogEntries = await listEmployeeCatalog(env, {
    companyId,
    teamId,
    status,
  });

  const employees: EmployeeProjection[] = await Promise.all(
    catalogEntries.map(async (catalogEntry) => {
      const runtimeEmployee = getEmployeeById(catalogEntry.employeeId);
      const runtimeStatus = getRuntimeStatus({
        catalogStatus: catalogEntry.status,
        hasRuntimeEmployee: Boolean(runtimeEmployee),
      });

      const publicProfile = {
        displayName: catalogEntry.employeeName,
        bio: catalogEntry.bio,
        skills: parseSkillsJson(catalogEntry.skillsJson),
        avatarUrl: catalogEntry.photoUrl,
      };

      const hasCognitiveProfile = Boolean(
        catalogEntry.bio ||
          catalogEntry.tone ||
          catalogEntry.skillsJson ||
          catalogEntry.photoUrl,
      );

      const identity = {
        employeeId: catalogEntry.employeeId,
        companyId: toCompanyId(catalogEntry.companyId),
        teamId: toTeamId(catalogEntry.teamId),
        roleId: toAgentRoleId(catalogEntry.roleId),
      };

      if (!runtimeEmployee) {
        return {
          identity,
          runtime: {
            runtimeStatus,
          },
          publicProfile,
          hasCognitiveProfile,
        };
      }

      const scope = await resolveAllowedScope(env, catalogEntry.employeeId);
      const control = await store.getEffective(
        catalogEntry.employeeId,
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

      return {
        identity,
        runtime: {
          runtimeStatus,
          effectiveState: {
            state: control.state,
            blocked: control.blocked,
          },
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
        },
        publicProfile,
        hasCognitiveProfile,
      };
    }),
  );

  return Response.json({
    ok: true,
    count: employees.length,
    employees,
  });
}