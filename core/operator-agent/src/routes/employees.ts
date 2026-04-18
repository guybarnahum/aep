import { createStores } from "@aep/operator-agent/lib/store-factory";
import {
  listEmployeeCatalog,
  listEmployeePublicLinks,
} from "@aep/operator-agent/persistence/d1/employee-catalog-store-d1";
import { createEmployee } from "@aep/operator-agent/persistence/d1/employee-lifecycle-store-d1";
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
  EmployeeEmploymentStatus,
  EmployeePublicLink,
  EmployeeProjection,
  EmployeeRuntimeStatus,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

type CreateEmployeeRequest = {
  employeeId?: string;
  companyId?: string;
  teamId?: string;
  roleId?: AgentRoleId;
  employeeName?: string;
  runtimeStatus?: "planned" | "active" | "disabled";
  employmentStatus?: EmployeeEmploymentStatus;
  schedulerMode?: string;
  bio?: string;
  tone?: string;
  skills?: string[];
  avatarUrl?: string;
  appearanceSummary?: string;
  birthYear?: number;
  publicLinks?: EmployeePublicLink[];
  isSynthetic?: boolean;
  approvedBy?: string;
  threadId?: string;
  effectiveAt?: string;
  reason?: string;
};

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

function toEmploymentStatus(value: string): EmployeeEmploymentStatus {
  switch (value) {
    case "draft":
    case "active":
    case "on_leave":
    case "retired":
    case "terminated":
    case "archived":
      return value;
    default:
      return "active";
  }
}

export async function handleEmployees(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") {
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

  if (request.method === "POST") {
    let body: CreateEmployeeRequest;
    try {
      body = (await request.json()) as CreateEmployeeRequest;
    } catch {
      return Response.json(
        { ok: false, error: "Request body must be valid JSON" },
        { status: 400 },
      );
    }

    if (!body.teamId || !body.roleId || !body.employeeName) {
      return Response.json(
        {
          ok: false,
          error: "teamId, roleId, and employeeName are required",
        },
        { status: 400 },
      );
    }

    try {
      const result = await createEmployee(env, {
        employeeId: body.employeeId,
        companyId: body.companyId,
        teamId: body.teamId,
        roleId: body.roleId,
        employeeName: body.employeeName,
        runtimeStatus: body.runtimeStatus,
        employmentStatus: body.employmentStatus,
        schedulerMode: body.schedulerMode,
        bio: body.bio,
        tone: body.tone,
        skills: body.skills,
        avatarUrl: body.avatarUrl,
        appearanceSummary: body.appearanceSummary,
        birthYear: body.birthYear,
        publicLinks: body.publicLinks,
        isSynthetic: body.isSynthetic === true,
        approvedBy: body.approvedBy,
        threadId: body.threadId,
        effectiveAt: body.effectiveAt,
        reason: body.reason,
      });

      return Response.json(
        {
          ok: true,
          employeeId: result.employeeId,
          employmentStatus: result.employmentStatus,
        },
        { status: 201 },
      );
    } catch (error) {
      return Response.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : "Failed to create employee",
        },
        { status: 400 },
      );
    }
  }

  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId") ?? undefined;
  const teamId = url.searchParams.get("teamId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const employmentStatus = url.searchParams.get("employmentStatus") ?? undefined;

  const store = createStores(env).employeeControls;
  const catalogEntries = await listEmployeeCatalog(env, {
    companyId,
    teamId,
    status,
    employmentStatus,
  });
  const publicLinksByEmployeeId = await listEmployeePublicLinks(
    env,
    catalogEntries.map((entry) => entry.employeeId),
  );

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
      const publicLinks =
        publicLinksByEmployeeId[catalogEntry.employeeId] ?? [];

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
          employment: {
            employmentStatus: toEmploymentStatus(catalogEntry.employmentStatus),
            schedulerMode: catalogEntry.schedulerMode,
            isSynthetic: catalogEntry.isSynthetic,
          },
          runtime: {
            runtimeStatus,
          },
          publicProfile,
          publicLinks,
          visualIdentity:
            catalogEntry.appearanceSummary ||
            typeof catalogEntry.birthYear === "number" ||
            catalogEntry.photoUrl
              ? {
                  birthYear: catalogEntry.birthYear,
                  appearanceSummary: catalogEntry.appearanceSummary,
                  avatarUrl: catalogEntry.photoUrl,
                }
              : undefined,
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
        employment: {
          employmentStatus: toEmploymentStatus(catalogEntry.employmentStatus),
          schedulerMode: catalogEntry.schedulerMode,
          isSynthetic: catalogEntry.isSynthetic,
        },
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
        publicLinks,
        visualIdentity:
          catalogEntry.appearanceSummary ||
          typeof catalogEntry.birthYear === "number" ||
          catalogEntry.photoUrl
            ? {
                birthYear: catalogEntry.birthYear,
                appearanceSummary: catalogEntry.appearanceSummary,
                avatarUrl: catalogEntry.photoUrl,
              }
            : undefined,
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