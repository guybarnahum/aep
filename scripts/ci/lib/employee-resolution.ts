import type { EmployeeRuntimeStatus, EmployeesListResponse } from "../contracts/employees";

type ResolveEmployeeIdByRoleArgs = {
  agentBaseUrl: string;
  roleId: string;
  teamId?: string;
  runtimeStatus?: EmployeeRuntimeStatus;
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

  const employee =
    matchingEmployees.find(
      (entry) =>
        entry.employment.employmentStatus === "active"
        && entry.employment.isSynthetic !== true,
    )
    ?? matchingEmployees.find(
      (entry) => entry.employment.employmentStatus === "active",
    )
    ?? matchingEmployees.find((entry) => entry.employment.isSynthetic !== true)
    ?? matchingEmployees[0];

  if (!employee) {
    throw new Error(
      `No employee found for roleId=${args.roleId}${args.teamId ? ` teamId=${args.teamId}` : ""}${args.runtimeStatus ? ` runtimeStatus=${args.runtimeStatus}` : ""}`,
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
      });

      return [entry.key, employeeId] as const;
    }),
  );

  return Object.fromEntries(resolvedEntries);
}