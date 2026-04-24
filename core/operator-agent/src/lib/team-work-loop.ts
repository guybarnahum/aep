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
import { newId } from "@aep/shared";

export type TeamWorkLoopStatus =
  | "execution_failed"
  | "executed_task"
  | "no_pending_tasks"
  | "waiting_for_staffing";

export type TeamHeartbeatPublication = {
  status: "published" | "skipped_missing_author";
  threadId?: string;
  messageId?: string;
};

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
  heartbeat?: TeamHeartbeatPublication;
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

function selectHeartbeatAuthor(args: {
  task: Task;
  resolution?: TeamRuntimeResolution;
}): string | undefined {
  return (
    args.resolution?.employee?.identity.employeeId ??
    args.task.assignedEmployeeId ??
    args.task.ownerEmployeeId ??
    args.task.createdByEmployeeId
  );
}

function heartbeatThreadTopic(teamId: TeamId, task: Task): string {
  return `Team heartbeat: ${teamId} / ${task.id}`;
}

async function ensureHeartbeatThread(args: {
  env: OperatorAgentEnv;
  task: Task;
  teamId: TeamId;
  authorEmployeeId: string;
}): Promise<string> {
  const taskStore = getTaskStore(args.env);
  const existingThreads = await taskStore.listMessageThreads({
    companyId: args.task.companyId,
    relatedTaskId: args.task.id,
    limit: 25,
  });
  const topic = heartbeatThreadTopic(args.teamId, args.task);
  const existing = existingThreads.find((thread) => thread.topic === topic);

  if (existing) {
    return existing.id;
  }

  const threadId = newId(`thr_team_heartbeat_${args.task.id}`);
  await taskStore.createMessageThread({
    id: threadId,
    companyId: args.task.companyId,
    topic,
    createdByEmployeeId: args.authorEmployeeId,
    relatedTaskId: args.task.id,
    visibility: "org",
  });

  return threadId;
}

async function publishTeamHeartbeat(args: {
  env: OperatorAgentEnv;
  task: Task;
  teamId: TeamId;
  resolution?: TeamRuntimeResolution;
  status: TeamWorkLoopStatus;
  body: string;
}): Promise<TeamHeartbeatPublication> {
  const authorEmployeeId = selectHeartbeatAuthor({
    task: args.task,
    resolution: args.resolution,
  });

  if (!authorEmployeeId) {
    return { status: "skipped_missing_author" };
  }

  const taskStore = getTaskStore(args.env);
  const threadId = await ensureHeartbeatThread({
    env: args.env,
    task: args.task,
    teamId: args.teamId,
    authorEmployeeId,
  });
  const messageId = newId(`msg_team_heartbeat_${args.task.id}`);

  await taskStore.createMessage({
    id: messageId,
    threadId,
    companyId: args.task.companyId,
    senderEmployeeId: authorEmployeeId,
    receiverTeamId: args.teamId,
    type: "coordination",
    status: "delivered",
    source: "system",
    subject: "Team heartbeat",
    body: args.body,
    payload: {
      kind: "team_heartbeat",
      teamId: args.teamId,
      taskId: args.task.id,
      status: args.status,
      resolutionStatus: args.resolution?.status,
      candidateEmployeeIds: args.resolution?.candidateEmployeeIds ?? [],
    },
    requiresResponse: false,
    relatedTaskId: args.task.id,
  });

  return {
    status: "published",
    threadId,
    messageId,
  };
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
    const message = resolution.message;
    const heartbeat = await publishTeamHeartbeat({
      env: args.env,
      task,
      teamId: args.teamId,
      resolution,
      status: "waiting_for_staffing",
      body: message,
    });

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
      heartbeat,
      resolution,
      message,
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
  let result: AgentExecutionResponse;

  try {
    result = await executeEmployeeRun(
      request,
      args.env,
      executionContext,
      taskContext,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const heartbeat = await publishTeamHeartbeat({
      env: args.env,
      task,
      teamId: args.teamId,
      resolution,
      status: "execution_failed",
      body: `Team ${args.teamId} selected task ${task.id}, but execution failed for ${resolution.employee.identity.employeeId}: ${message}`,
    });

    return {
      ok: true,
      status: "execution_failed",
      companyId,
      teamId: args.teamId,
      scanned: {
        pendingTasks: pendingTasks.length,
        eligibleTasks: eligibleTasks.length,
      },
      taskId: task.id,
      employeeId: resolution.employee.identity.employeeId,
      roleId: resolution.employee.identity.roleId,
      heartbeat,
      resolution,
      message,
    };
  }

  const message = `Executed task ${task.id} for ${args.teamId} via ${resolution.employee.identity.employeeId}.`;
  const heartbeat = await publishTeamHeartbeat({
    env: args.env,
    task,
    teamId: args.teamId,
    resolution,
    status: "executed_task",
    body: message,
  });

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
    heartbeat,
    resolution,
    result,
    message,
  };
}