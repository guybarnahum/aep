import { getConfig } from "@aep/operator-agent/config";
import { makeCronFallbackContext } from "@aep/operator-agent/lib/execution-context";
import { executeEmployeeRun } from "@aep/operator-agent/lib/execute-employee-run";
import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type {
  Task,
  TaskArtifact,
} from "@aep/operator-agent/lib/store-types";
import { COMPANY_INTERNAL_AEP, type CompanyId } from "@aep/operator-agent/org/company";
import type { TeamId } from "@aep/operator-agent/org/teams";
import type {
  AgentExecutionResponse,
  CoordinationTaskArtifactRecord,
  CoordinationTaskRecord,
  EmployeeRunRequest,
  OperatorAgentEnv,
  ResolvedTaskExecutionContext,
} from "@aep/operator-agent/types";
import {
  resolveRuntimeEmployeeForTeamTask,
  type TeamRuntimeResolution,
} from "@aep/operator-agent/lib/team-runtime-resolver";

export type TeamWorkLoopStatus =
  | "executed_task"
  | "no_pending_tasks"
  | "waiting_for_staffing";

export interface TeamWorkLoopResult {
  ok: true;
  status: TeamWorkLoopStatus;
  companyId: CompanyId;
  teamId: TeamId;
  scanned: {
    pendingTasks: number;
    eligibleTasks: number;
  };
  taskId?: string;
  employeeId?: string;
  roleId?: string;
  resolution?: TeamRuntimeResolution;
  result?: AgentExecutionResponse;
  message: string;
}

function toCompanyId(companyId?: string): CompanyId {
  return (companyId ?? COMPANY_INTERNAL_AEP) as CompanyId;
}

function prioritizeTask(tasks: Task[]): Task | undefined {
  return tasks.find((task) => task.status === "ready")
    ?? tasks.find((task) => task.status === "queued");
}

function toCoordinationTaskRecord(task: Task): CoordinationTaskRecord {
  return {
    ...task,
    companyId: toCompanyId(task.companyId),
    originatingTeamId: task.originatingTeamId as TeamId,
    assignedTeamId: task.assignedTeamId as TeamId,
  };
}

function toCoordinationTaskArtifactRecord(
  artifact: TaskArtifact,
): CoordinationTaskArtifactRecord {
  return {
    ...artifact,
    companyId: toCompanyId(artifact.companyId),
  };
}

async function loadTaskExecutionContext(args: {
  env: OperatorAgentEnv;
  task: Task;
}): Promise<ResolvedTaskExecutionContext> {
  const taskStore = getTaskStore(args.env);
  const [dependencies, artifacts] = await Promise.all([
    taskStore.listDependencies(args.task.id),
    taskStore.listArtifacts({
      taskId: args.task.id,
      limit: 50,
    }),
  ]);

  return {
    task: toCoordinationTaskRecord(args.task),
    dependencies,
    artifacts: artifacts.map(toCoordinationTaskArtifactRecord),
  };
}

export async function runTeamWorkLoop(args: {
  env: OperatorAgentEnv;
  teamId: TeamId;
  companyId?: CompanyId;
  limit?: number;
}): Promise<TeamWorkLoopResult> {
  const config = getConfig(args.env);
  const companyId = args.companyId ?? COMPANY_INTERNAL_AEP;
  const taskStore = getTaskStore(args.env);
  const pendingTasks = await taskStore.getPendingTasksForTeam({
    teamId: args.teamId,
    limit: args.limit ?? 20,
  });
  const eligibleTasks = pendingTasks.filter((task) => task.companyId === companyId);
  const task = prioritizeTask(eligibleTasks);

  if (!task) {
    return {
      ok: true,
      status: "no_pending_tasks",
      companyId,
      teamId: args.teamId,
      scanned: {
        pendingTasks: pendingTasks.length,
        eligibleTasks: eligibleTasks.length,
      },
      message: `No queued or ready canonical tasks are available for ${args.teamId}.`,
    };
  }

  const resolution = await resolveRuntimeEmployeeForTeamTask({
    env: args.env,
    task,
  });

  if (!resolution.employee) {
    return {
      ok: true,
      status: "waiting_for_staffing",
      companyId,
      teamId: args.teamId,
      scanned: {
        pendingTasks: pendingTasks.length,
        eligibleTasks: eligibleTasks.length,
      },
      taskId: task.id,
      resolution,
      message: resolution.message,
    };
  }

  const taskContext = await loadTaskExecutionContext({
    env: args.env,
    task,
  });
  const executionContext = makeCronFallbackContext(
    resolution.employee.identity.employeeId,
  );
  const request: EmployeeRunRequest = {
    companyId,
    teamId: args.teamId,
    taskId: task.id,
    employeeId: resolution.employee.identity.employeeId,
    roleId: resolution.employee.identity.roleId,
    trigger: "cron",
    policyVersion: config.policyVersion,
  };
  const result = await executeEmployeeRun(
    request,
    args.env,
    executionContext,
    taskContext,
  );

  return {
    ok: true,
    status: "executed_task",
    companyId,
    teamId: args.teamId,
    scanned: {
      pendingTasks: pendingTasks.length,
      eligibleTasks: eligibleTasks.length,
    },
    taskId: task.id,
    employeeId: resolution.employee.identity.employeeId,
    roleId: resolution.employee.identity.roleId,
    resolution,
    result,
    message: `Executed task ${task.id} for ${args.teamId} via ${resolution.employee.identity.employeeId}.`,
  };
}