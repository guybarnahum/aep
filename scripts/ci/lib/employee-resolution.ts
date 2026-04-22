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

export async function resolveEmployeeIdByRole(
  args: ResolveEmployeeIdByRoleArgs,
): Promise<string> {
  const baseUrl = args.agentBaseUrl.replace(/\/$/, "");
  const search = new URLSearchParams({
    status: "active",
    employmentStatus: "active",
  });

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

  const employee = json.employees.find((entry) => {
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

  if (!employee) {
    throw new Error(
      `No active employee found for roleId=${args.roleId}${args.teamId ? ` teamId=${args.teamId}` : ""}${args.runtimeStatus ? ` runtimeStatus=${args.runtimeStatus}` : ""}`,
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