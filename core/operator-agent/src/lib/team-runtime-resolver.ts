import { COMPANY_INTERNAL_AEP, type CompanyId } from "@aep/operator-agent/org/company";
import { isTeamId, type TeamId } from "@aep/operator-agent/org/teams";
import {
  resolveRuntimeEmployeeById,
  resolveRuntimeEmployeesForTeam,
} from "@aep/operator-agent/persistence/d1/runtime-employee-resolver-d1";
import type { Task } from "@aep/operator-agent/lib/store-types";
import type {
  AgentEmployeeDefinition,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

export type TeamRuntimeResolutionStatus =
  | "resolved_assigned_employee"
  | "resolved_team_runtime_employee"
  | "waiting_for_staffing";

export interface TeamRuntimeResolution {
  status: TeamRuntimeResolutionStatus;
  companyId: CompanyId;
  teamId: TeamId;
  taskId: string;
  employee?: AgentEmployeeDefinition;
  candidateEmployeeIds: string[];
  message: string;
}

function formatCandidateEmployeeIds(candidates: AgentEmployeeDefinition[]): string {
  if (candidates.length === 0) {
    return "none";
  }

  return candidates.map((candidate) => candidate.identity.employeeId).join(", ");
}

function toCompanyId(companyId: string): CompanyId {
  return (companyId || COMPANY_INTERNAL_AEP) as CompanyId;
}

export async function resolveRuntimeEmployeeForTeamTask(args: {
  env: OperatorAgentEnv;
  task: Task;
}): Promise<TeamRuntimeResolution> {
  const companyId = toCompanyId(args.task.companyId);

  if (!isTeamId(args.task.assignedTeamId)) {
    return {
      status: "waiting_for_staffing",
      companyId,
      teamId: args.task.assignedTeamId as TeamId,
      taskId: args.task.id,
      candidateEmployeeIds: [],
      message: `Task ${args.task.id} references unknown assignedTeamId ${args.task.assignedTeamId}.`,
    };
  }

  const teamId = args.task.assignedTeamId;

  if (args.task.assignedEmployeeId) {
    const assignedEmployee = await resolveRuntimeEmployeeById(
      args.env,
      args.task.assignedEmployeeId,
    );

    if (
      assignedEmployee &&
      assignedEmployee.identity.companyId === companyId &&
      assignedEmployee.identity.teamId === teamId
    ) {
      return {
        status: "resolved_assigned_employee",
        companyId,
        teamId,
        taskId: args.task.id,
        employee: assignedEmployee,
        candidateEmployeeIds: [assignedEmployee.identity.employeeId],
        message: `Task ${args.task.id} will run through assigned employee ${assignedEmployee.identity.employeeId}.`,
      };
    }

    const roster = await resolveRuntimeEmployeesForTeam({
      env: args.env,
      companyId,
      teamId,
    });

    return {
      status: "waiting_for_staffing",
      companyId,
      teamId,
      taskId: args.task.id,
      candidateEmployeeIds: roster.map((candidate) => candidate.identity.employeeId),
      message:
        `Task ${args.task.id} is assigned to unavailable runtime employee ${args.task.assignedEmployeeId}. ` +
        `Current team runtime roster: ${formatCandidateEmployeeIds(roster)}.`,
    };
  }

  const roster = await resolveRuntimeEmployeesForTeam({
    env: args.env,
    companyId,
    teamId,
  });

  if (roster.length === 0) {
    return {
      status: "waiting_for_staffing",
      companyId,
      teamId,
      taskId: args.task.id,
      candidateEmployeeIds: [],
      message: `Task ${args.task.id} is ready for ${teamId}, but no active runtime employees are available.`,
    };
  }

  const employee = roster[0];

  return {
    status: "resolved_team_runtime_employee",
    companyId,
    teamId,
    taskId: args.task.id,
    employee,
    candidateEmployeeIds: roster.map((candidate) => candidate.identity.employeeId),
    message: `Task ${args.task.id} will run through team runtime employee ${employee.identity.employeeId}.`,
  };
}