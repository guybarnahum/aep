import type {
  EmployeeEffectivePolicyResponse,
  EmployeeRuntimeStatus,
  EmployeeScopeResponse,
  EmployeesListResponse,
  RoleJobDescriptionProjection,
  RolesListResponse,
} from "../contracts/employees";

type ResolveEmployeeScopeRequirements = {
  allowedTenants?: string[];
  allowedServices?: string[];
  allowedEnvironmentNames?: string[];
};

type ResolveEmployeeRoleRequirements = {
  runtimeEnabled?: boolean;
  implementationBinding?: string;
  managerRoleId?: string;
  employeeIdCode?: string;
};

type ResolveEmployeeCandidate = EmployeesListResponse["employees"][number];

type ResolveEmployeeCandidateInspector = {
  getScope(): Promise<EmployeeScopeResponse>;
  getEffectivePolicy(): Promise<EmployeeEffectivePolicyResponse>;
  getRole(): Promise<RoleJobDescriptionProjection | null>;
  fetchJson<T>(path: string): Promise<T>;
};

type ResolveEmployeeRequirements = {
  scope?: ResolveEmployeeScopeRequirements;
  role?: ResolveEmployeeRoleRequirements;
  matchCandidate?: (
    candidate: ResolveEmployeeCandidate,
    inspector: ResolveEmployeeCandidateInspector,
  ) => Promise<boolean>;
};

type ResolveEmployeeIdByRoleArgs = {
  agentBaseUrl: string;
  roleId: string;
  teamId?: string;
  runtimeStatus?: EmployeeRuntimeStatus;
  required?: ResolveEmployeeRequirements;
};

type ResolveNamedEmployeeIdArgs = Omit<ResolveEmployeeIdByRoleArgs, "agentBaseUrl"> & {
  key: string;
};

async function readJson(response: Response): Promise<unknown> {
  const body = await response.text();
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return { raw: body };
  }
}

async function getJson<T>(url: string, label: string): Promise<T> {
  const response = await fetch(url);
  const json = (await readJson(response)) as T & { ok?: boolean; raw?: string };

  if (response.status !== 200) {
    throw new Error(
      `Failed to load ${label}: status=${response.status}, body=${JSON.stringify(json)}`,
    );
  }

  return json as T;
}

function getCatalogStatusFilter(
  runtimeStatus?: EmployeeRuntimeStatus,
): string | undefined {
  if (runtimeStatus === "implemented") {
    return "active";
  }

  if (runtimeStatus === "planned") {
    return "planned";
  }

  return undefined;
}

function getEmploymentStatusFilter(
  runtimeStatus?: EmployeeRuntimeStatus,
): string | undefined {
  if (runtimeStatus === "implemented") {
    return "active";
  }

  return undefined;
}

function includesAll(observed: string[], required?: string[]): boolean {
  if (!required || required.length === 0) {
    return true;
  }

  return required.every((value) => observed.includes(value));
}

function matchesScopeRequirements(
  scope: EmployeeScopeResponse,
  required?: ResolveEmployeeScopeRequirements,
): boolean {
  if (!required) {
    return true;
  }

  return (
    includesAll(scope.allowedTenants, required.allowedTenants)
    && includesAll(scope.allowedServices, required.allowedServices)
    && includesAll(
      scope.allowedEnvironmentNames,
      required.allowedEnvironmentNames,
    )
  );
}

function matchesRoleRequirements(
  role: RoleJobDescriptionProjection | null,
  required?: ResolveEmployeeRoleRequirements,
): boolean {
  if (!required) {
    return true;
  }

  if (!role) {
    return false;
  }

  if (
    typeof required.runtimeEnabled === "boolean"
    && role.runtimeEnabled !== required.runtimeEnabled
  ) {
    return false;
  }

  if (
    typeof required.implementationBinding === "string"
    && role.implementationBinding !== required.implementationBinding
  ) {
    return false;
  }

  if (
    typeof required.managerRoleId === "string"
    && role.managerRoleId !== required.managerRoleId
  ) {
    return false;
  }

  if (
    typeof required.employeeIdCode === "string"
    && role.employeeIdCode !== required.employeeIdCode
  ) {
    return false;
  }

  return true;
}

function describeRequirements(required?: ResolveEmployeeRequirements): string {
  if (!required) {
    return "";
  }

  const parts: string[] = [];

  if (required.scope?.allowedTenants?.length) {
    parts.push(`allowedTenants=${required.scope.allowedTenants.join(",")}`);
  }

  if (required.scope?.allowedServices?.length) {
    parts.push(`allowedServices=${required.scope.allowedServices.join(",")}`);
  }

  if (required.scope?.allowedEnvironmentNames?.length) {
    parts.push(
      `allowedEnvironmentNames=${required.scope.allowedEnvironmentNames.join(",")}`,
    );
  }

  if (typeof required.role?.runtimeEnabled === "boolean") {
    parts.push(`runtimeEnabled=${String(required.role.runtimeEnabled)}`);
  }

  if (required.role?.implementationBinding) {
    parts.push(`implementationBinding=${required.role.implementationBinding}`);
  }

  if (required.role?.managerRoleId) {
    parts.push(`managerRoleId=${required.role.managerRoleId}`);
  }

  if (required.role?.employeeIdCode) {
    parts.push(`employeeIdCode=${required.role.employeeIdCode}`);
  }

  if (required.matchCandidate) {
    parts.push("customMatcher=true");
  }

  return parts.length > 0 ? ` required(${parts.join(" ")})` : "";
}

export async function resolveEmployeeIdByRole(
  args: ResolveEmployeeIdByRoleArgs,
): Promise<string> {
  const baseUrl = args.agentBaseUrl.replace(/\/$/, "");
  const search = new URLSearchParams();
  const catalogStatus = getCatalogStatusFilter(args.runtimeStatus);
  const employmentStatus = getEmploymentStatusFilter(args.runtimeStatus);

  if (catalogStatus) {
    search.set("status", catalogStatus);
  }

  if (employmentStatus) {
    search.set("employmentStatus", employmentStatus);
  }

  if (args.teamId) {
    search.set("teamId", args.teamId);
  }

  const response = await fetch(`${baseUrl}/agent/employees?${search.toString()}`);
  const json = (await readJson(response)) as EmployeesListResponse & {
    raw?: string;
  };

  if (response.status !== 200 || !json?.ok || !Array.isArray(json.employees)) {
    throw new Error(
      `Failed to resolve employees from /agent/employees: status=${response.status}, body=${JSON.stringify(json)}`,
    );
  }

  const matchingEmployees = json.employees.filter((entry) => {
    if (entry.identity.roleId !== args.roleId) {
      return false;
    }

    if (args.teamId && entry.identity.teamId !== args.teamId) {
      return false;
    }

    if (args.runtimeStatus && entry.runtime.runtimeStatus !== args.runtimeStatus) {
      return false;
    }

    return true;
  });

  const scopeCache = new Map<string, Promise<EmployeeScopeResponse>>();
  const effectivePolicyCache = new Map<string, Promise<EmployeeEffectivePolicyResponse>>();
  let rolesByIdPromise: Promise<Map<string, RoleJobDescriptionProjection>> | undefined;

  async function getRolesById(): Promise<Map<string, RoleJobDescriptionProjection>> {
    if (!rolesByIdPromise) {
      rolesByIdPromise = (async () => {
        const rolesResponse = await getJson<RolesListResponse>(
          `${baseUrl}/agent/roles`,
          "/agent/roles",
        );

        if (!rolesResponse.ok || !Array.isArray(rolesResponse.roles)) {
          throw new Error(
            `Failed to resolve roles from /agent/roles: body=${JSON.stringify(rolesResponse)}`,
          );
        }

        return new Map(
          rolesResponse.roles.map((role) => [role.roleId, role] as const),
        );
      })();
    }

    return rolesByIdPromise;
  }

  function createInspector(
    candidate: ResolveEmployeeCandidate,
  ): ResolveEmployeeCandidateInspector {
    const employeeId = candidate.identity.employeeId;

    return {
      getScope() {
        const cached = scopeCache.get(employeeId);
        if (cached) {
          return cached;
        }

        const request = getJson<EmployeeScopeResponse>(
          `${baseUrl}/agent/employees/${encodeURIComponent(employeeId)}/scope`,
          `/agent/employees/${employeeId}/scope`,
        );
        scopeCache.set(employeeId, request);
        return request;
      },
      getEffectivePolicy() {
        const cached = effectivePolicyCache.get(employeeId);
        if (cached) {
          return cached;
        }

        const request = getJson<EmployeeEffectivePolicyResponse>(
          `${baseUrl}/agent/employees/${encodeURIComponent(employeeId)}/effective-policy`,
          `/agent/employees/${employeeId}/effective-policy`,
        );
        effectivePolicyCache.set(employeeId, request);
        return request;
      },
      async getRole() {
        const rolesById = await getRolesById();
        return rolesById.get(candidate.identity.roleId) ?? null;
      },
      fetchJson<T>(path: string) {
        const normalizedPath = path.startsWith("/") ? path : `/${path}`;
        return getJson<T>(`${baseUrl}${normalizedPath}`, normalizedPath);
      },
    };
  }

  let candidatePool = matchingEmployees;

  if (args.required) {
    const filteredMatches: ResolveEmployeeCandidate[] = [];

    for (const candidate of matchingEmployees) {
      const inspector = createInspector(candidate);

      if (args.required.scope) {
        const scope = await inspector.getScope();
        if (!matchesScopeRequirements(scope, args.required.scope)) {
          continue;
        }
      }

      if (args.required.role) {
        const role = await inspector.getRole();
        if (!matchesRoleRequirements(role, args.required.role)) {
          continue;
        }
      }

      if (args.required.matchCandidate) {
        const matched = await args.required.matchCandidate(candidate, inspector);
        if (!matched) {
          continue;
        }
      }

      filteredMatches.push(candidate);
    }

    candidatePool = filteredMatches;
  }

  const employee =
    candidatePool.find(
      (entry) =>
        entry.employment.employmentStatus === "active"
        && entry.employment.isSynthetic !== true,
    )
    ?? candidatePool.find(
      (entry) => entry.employment.employmentStatus === "active",
    )
    ?? candidatePool.find((entry) => entry.employment.isSynthetic !== true)
    ?? candidatePool[0];

  if (!employee) {
    throw new Error(
      `No employee found for roleId=${args.roleId}${args.teamId ? ` teamId=${args.teamId}` : ""}${args.runtimeStatus ? ` runtimeStatus=${args.runtimeStatus}` : ""}${describeRequirements(args.required)}`,
    );
  }

  return employee.identity.employeeId;
}

export async function resolveEmployeeIdsByKey(args: {
  agentBaseUrl: string;
  employees: ResolveNamedEmployeeIdArgs[];
}): Promise<Record<string, string>> {
  const resolvedEntries = await Promise.all(
    args.employees.map(async (entry) => {
      const employeeId = await resolveEmployeeIdByRole({
        agentBaseUrl: args.agentBaseUrl,
        roleId: entry.roleId,
        teamId: entry.teamId,
        runtimeStatus: entry.runtimeStatus,
        required: entry.required,
      });

      return [entry.key, employeeId] as const;
    }),
  );

  return Object.fromEntries(resolvedEntries);
}