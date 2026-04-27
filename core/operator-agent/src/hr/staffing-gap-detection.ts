import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import { getDefaultRoleIdForTaskType } from "@aep/operator-agent/lib/task-contracts";
import { listEmployeeCatalog } from "@aep/operator-agent/persistence/d1/employee-catalog-store-d1";
import { listRoleCatalog } from "@aep/operator-agent/persistence/d1/role-catalog-store-d1";
import type { RoleGapContract } from "@aep/operator-agent/hr/staffing-contracts";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export type StaffingGapDetectionResult = {
  ok: true;
  advisoryOnly: true;
  gaps: RoleGapContract[];
  summary: {
    roleGaps: number;
    teamMissingRequiredRoles: number;
    taskBlockedByMissingRole: number;
    inactiveOrOnLeaveImpacts: number;
  };
};

function roleGapId(parts: string[]): string {
  return `rolegap_${parts.join("_")}`.replace(/[^a-zA-Z0-9_]/g, "_");
}

export async function detectStaffingGaps(
  env: OperatorAgentEnv,
): Promise<StaffingGapDetectionResult> {
  const [roles, employees, tasks] = await Promise.all([
    listRoleCatalog(env),
    listEmployeeCatalog(env),
    getTaskStore(env).listTasks({ limit: 200 }),
  ]);

  const activeEmployees = employees.filter(
    (employee) =>
      employee.status === "active" &&
      employee.employmentStatus === "active",
  );

  const inactiveOrOnLeave = employees.filter(
    (employee) =>
      employee.employmentStatus === "on_leave" ||
      employee.employmentStatus === "terminated" ||
      employee.employmentStatus === "retired",
  );

  const gaps: RoleGapContract[] = [];

  for (const role of roles) {
    const activeForRole = activeEmployees.filter(
      (employee) =>
        employee.roleId === role.roleId &&
        employee.teamId === role.teamId,
    );

    if (activeForRole.length === 0) {
      gaps.push({
        kind: "role_gap",
        roleGapId: roleGapId([role.teamId, role.roleId, "no_active_employee"]),
        companyId: "company_internal_aep",
        roleId: role.roleId as RoleGapContract["roleId"],
        teamId: role.teamId as RoleGapContract["teamId"],
        reason: "no_active_employee",
        source: { kind: "role", roleId: role.roleId as RoleGapContract["roleId"] },
        ownership: {
          canonicalOwner: "aep",
          owningTeamId: role.teamId as RoleGapContract["teamId"],
          directEmployeeMutationAllowed: false,
          parallelHrDatabaseAllowed: false,
        },
        state: "detected",
        approval: {
          approvalRequired: false,
          approvalSurface: "advisory_only",
          directFulfillmentAllowed: false,
        },
      });
    }
  }

  for (const task of tasks) {
    if (!["queued", "ready", "blocked"].includes(task.status)) continue;

    const expectedRoleId = getDefaultRoleIdForTaskType(task.taskType);
    const candidateEmployees = activeEmployees.filter(
      (employee) =>
        employee.teamId === task.assignedTeamId &&
        (!expectedRoleId || employee.roleId === expectedRoleId),
    );

    const assignedEmployee = task.assignedEmployeeId
      ? employees.find((employee) => employee.employeeId === task.assignedEmployeeId)
      : undefined;

    const assignedUnavailable =
      assignedEmployee &&
      assignedEmployee.employmentStatus !== "active";

    if (candidateEmployees.length === 0 || assignedUnavailable) {
      gaps.push({
        kind: "role_gap",
        roleGapId: roleGapId([
          task.assignedTeamId,
          expectedRoleId ?? "team_capacity",
          task.id,
          assignedUnavailable ? "employee_unavailable" : "task_blocked",
        ]),
        companyId: "company_internal_aep",
        roleId: (expectedRoleId ?? "product-manager") as RoleGapContract["roleId"],
        teamId: task.assignedTeamId as RoleGapContract["teamId"],
        reason: assignedUnavailable
          ? "employee_on_leave"
          : "task_blocked_by_missing_role",
        source: { kind: "task", taskId: task.id },
        ownership: {
          canonicalOwner: "aep",
          owningTeamId: task.assignedTeamId as RoleGapContract["teamId"],
          directEmployeeMutationAllowed: false,
          parallelHrDatabaseAllowed: false,
        },
        state: "detected",
        approval: {
          approvalRequired: false,
          approvalSurface: "advisory_only",
          directFulfillmentAllowed: false,
        },
      });
    }
  }

  return {
    ok: true,
    advisoryOnly: true,
    gaps,
    summary: {
      roleGaps: gaps.filter((gap) => gap.reason === "no_active_employee").length,
      teamMissingRequiredRoles: gaps.filter((gap) => gap.reason === "required_role_missing").length,
      taskBlockedByMissingRole: gaps.filter((gap) => gap.reason === "task_blocked_by_missing_role").length,
      inactiveOrOnLeaveImpacts: inactiveOrOnLeave.length,
    },
  };
}
