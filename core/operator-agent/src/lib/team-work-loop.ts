import { getConfig } from "@aep/operator-agent/config";
import {
  derivePublicRationale,
  thinkWithinEmployeeBoundary,
} from "@aep/operator-agent/lib/employee-cognition";
import { makeCronFallbackContext } from "@aep/operator-agent/lib/execution-context";
import { executeEmployeeRun } from "@aep/operator-agent/lib/execute-employee-run";
import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type {
  Task,
  TaskArtifact,
} from "@aep/operator-agent/lib/store-types";
import { COMPANY_INTERNAL_AEP, type CompanyId } from "@aep/operator-agent/org/company";
import {
  TEAM_INFRA,
  TEAM_VALIDATION,
  TEAM_WEB_PRODUCT,
  type TeamId,
} from "@aep/operator-agent/org/teams";
import type {
  AgentRoleId,
  AgentExecutionResponse,
  CoordinationTaskArtifactRecord,
  CoordinationTaskRecord,
  EmployeeRunRequest,
  OperatorAgentEnv,
  ResolvedTaskExecutionContext,
} from "@aep/operator-agent/types";
import {
  evaluateTaskArtifactExpectations,
  getTaskDiscipline,
  getTaskTypePriority,
  getTeamDisciplinePriority,
  isTaskExpectedForTeam,
} from "@aep/operator-agent/lib/task-contracts";
import {
  resolveRuntimeEmployeeForTeamTask,
  type TeamRuntimeResolution,
} from "@aep/operator-agent/lib/team-runtime-resolver";
import { newId } from "@aep/shared";

export type TeamWorkLoopStatus =
  | "execution_failed"
  | "executed_task"
  | "manager_review_requested"
  | "no_pending_tasks"
  | "waiting_for_staffing";

export type TeamHeartbeatPublication = {
  status: "published" | "skipped_missing_author";
  threadId?: string;
  messageId?: string;
};

export type TeamTaskSelection = {
  status: "ready" | "queued";
  taskType: string;
  discipline: string;
  expectedForTeam: boolean;
  teamDisciplinePriority: number;
  taskTypePriority: number;
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
  selection?: TeamTaskSelection;
  heartbeat?: TeamHeartbeatPublication;
  resolution?: TeamRuntimeResolution;
  result?: AgentExecutionResponse;
  message: string;
}

function toCompanyId(companyId?: string): CompanyId {
  return (companyId ?? COMPANY_INTERNAL_AEP) as CompanyId;
}

type TaskCandidateStatus = "ready" | "queued";

type TeamTaskCandidate = {
  task: Task;
  status: TaskCandidateStatus;
  discipline: string;
  expectedForTeam: boolean;
  teamDisciplinePriority: number;
  taskTypePriority: number;
  createdAtRank: number;
};

type CognitiveTaskSelectionRecommendation = {
  selectedTaskId?: string;
  confidence: "low" | "medium" | "high";
  recommendation:
    | "execute"
    | "defer"
    | "request_manager_review";
  publicRationale: string;
  consideredTaskIds: string[];
};

function candidateStatusRank(status: TaskCandidateStatus): number {
  return status === "ready" ? 0 : 1;
}

function timestampRank(task: Task): number {
  const timestamp = task.createdAt ? Date.parse(task.createdAt) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function toTaskCandidate(task: Task, teamId: TeamId): TeamTaskCandidate | undefined {
  if (task.status !== "ready" && task.status !== "queued") {
    return undefined;
  }

  return {
    task,
    status: task.status,
    discipline: getTaskDiscipline(task.taskType),
    expectedForTeam: isTaskExpectedForTeam(task.taskType, teamId),
    teamDisciplinePriority: getTeamDisciplinePriority({ teamId, taskType: task.taskType }),
    taskTypePriority: getTaskTypePriority(task.taskType),
    createdAtRank: timestampRank(task),
  };
}

function compareCandidates(a: TeamTaskCandidate, b: TeamTaskCandidate): number {
  if (candidateStatusRank(a.status) !== candidateStatusRank(b.status)) {
    return candidateStatusRank(a.status) - candidateStatusRank(b.status);
  }

  if (a.expectedForTeam !== b.expectedForTeam) {
    return a.expectedForTeam ? -1 : 1;
  }

  if (a.teamDisciplinePriority !== b.teamDisciplinePriority) {
    return a.teamDisciplinePriority - b.teamDisciplinePriority;
  }

  if (a.taskTypePriority !== b.taskTypePriority) {
    return a.taskTypePriority - b.taskTypePriority;
  }

  if (a.createdAtRank !== b.createdAtRank) {
    return a.createdAtRank - b.createdAtRank;
  }

  return a.task.id.localeCompare(b.task.id);
}

function prioritizeCandidates(tasks: Task[], teamId: TeamId): TeamTaskCandidate[] {
  const candidates = tasks
    .map((task) => toTaskCandidate(task, teamId))
    .filter((candidate): candidate is TeamTaskCandidate => Boolean(candidate));

  candidates.sort(compareCandidates);
  return candidates;
}

function buildSchedulingContext(args: {
  teamId: TeamId;
  candidates: TeamTaskCandidate[];
}): Record<string, unknown> {
  return {
    teamId: args.teamId,
    candidates: args.candidates.map((candidate) => ({
      taskId: candidate.task.id,
      taskType: candidate.task.taskType,
      title: candidate.task.title,
      status: candidate.task.status,
      discipline: candidate.discipline,
      expectedForTeam: candidate.expectedForTeam,
      payloadSummary: {
        projectId: candidate.task.payload.projectId,
        priority: candidate.task.payload.priority,
        urgency: candidate.task.payload.urgency,
        deadline: candidate.task.payload.deadline,
      },
    })),
  };
}

function schedulerRoleForTeam(teamId: TeamId): AgentRoleId {
  if (teamId === TEAM_INFRA) {
    return "infra-ops-manager";
  }

  if (teamId === TEAM_VALIDATION) {
    return "validation-pm";
  }

  if (teamId === TEAM_WEB_PRODUCT) {
    return "product-manager-web";
  }

  return "product-manager";
}

function recommendationFromSuggestedNextAction(
  suggestedNextAction?: string,
): CognitiveTaskSelectionRecommendation["recommendation"] | undefined {
  if (!suggestedNextAction) {
    return undefined;
  }

  const normalized = suggestedNextAction.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (
    normalized.includes("request_manager_review")
    || (normalized.includes("manager") && normalized.includes("review"))
  ) {
    return "request_manager_review";
  }

  if (normalized.includes("defer")) {
    return "defer";
  }

  if (normalized.includes("execute")) {
    return "execute";
  }

  return undefined;
}

function selectedTaskFromCognition(args: {
  candidates: TeamTaskCandidate[];
  cognitionText: string;
}): string | undefined {
  for (const candidate of args.candidates) {
    if (args.cognitionText.includes(candidate.task.id)) {
      return candidate.task.id;
    }
  }

  return args.candidates[0]?.task.id;
}

async function selectTaskWithCognition(args: {
  env: OperatorAgentEnv;
  teamId: TeamId;
  candidates: TeamTaskCandidate[];
}): Promise<CognitiveTaskSelectionRecommendation> {
  const schedulingContext = buildSchedulingContext({
    teamId: args.teamId,
    candidates: args.candidates,
  });

  if (args.candidates.length === 0) {
    return {
      confidence: "high",
      recommendation: "defer",
      consideredTaskIds: [],
      publicRationale: "No candidate tasks were available for cognitive scheduling.",
    };
  }

  const roleId = schedulerRoleForTeam(args.teamId);
  const cognition = await thinkWithinEmployeeBoundary(
    {
      employee: {
        employeeId: `team_scheduler_${args.teamId}`,
        employeeName: `Team scheduler (${args.teamId})`,
        companyId: COMPANY_INTERNAL_AEP,
        teamId: args.teamId,
        roleId,
      },
      observations: [
        `Evaluate scheduling candidates for team ${args.teamId}.`,
        `Candidate IDs in deterministic priority order: ${args.candidates
          .map((candidate) => candidate.task.id)
          .join(", ")}`,
        `Scheduling context: ${JSON.stringify(schedulingContext)}`,
      ],
    },
    args.env,
  );

  const publicRationale = derivePublicRationale(cognition);
  const structuredAction = recommendationFromSuggestedNextAction(
    cognition.structured?.suggestedNextAction,
  );
  const recommendation = structuredAction
    ?? (cognition.structured?.riskLevel === "high"
      ? "request_manager_review"
      : "execute");
  const cognitionText = [
    cognition.publicSummary,
    cognition.structured?.intent ?? "",
    cognition.structured?.suggestedNextAction ?? "",
  ]
    .filter(Boolean)
    .join("\n");
  const selectedTaskId = recommendation === "execute"
    ? selectedTaskFromCognition({
      candidates: args.candidates,
      cognitionText,
    })
    : undefined;

  return {
    selectedTaskId,
    confidence: cognition.mode === "ai" ? "medium" : "low",
    recommendation,
    consideredTaskIds: args.candidates.map((candidate) => candidate.task.id),
    publicRationale: publicRationale.summary,
  };
}

function toSelection(candidate: TeamTaskCandidate): TeamTaskSelection {
  return {
    status: candidate.status,
    taskType: candidate.task.taskType,
    discipline: candidate.discipline,
    expectedForTeam: candidate.expectedForTeam,
    teamDisciplinePriority: candidate.teamDisciplinePriority,
    taskTypePriority: candidate.taskTypePriority,
  };
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
  selection?: TeamTaskSelection;
  artifactExpectations?: ReturnType<typeof evaluateTaskArtifactExpectations>;
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
      selection: args.selection,
      artifactExpectations: args.artifactExpectations,
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

async function publishSchedulingReviewThread(args: {
  env: OperatorAgentEnv;
  companyId: CompanyId;
  teamId: TeamId;
  recommendation: CognitiveTaskSelectionRecommendation;
  candidates: TeamTaskCandidate[];
}): Promise<void> {
  const taskStore = getTaskStore(args.env);
  const primaryTask = args.candidates[0]?.task;
  const authorEmployeeId =
    primaryTask?.assignedEmployeeId
    ?? primaryTask?.ownerEmployeeId
    ?? primaryTask?.createdByEmployeeId;

  if (!authorEmployeeId) {
    return;
  }

  const threadId = newId(`thr_team_sched_review_${args.teamId}`);
  await taskStore.createMessageThread({
    id: threadId,
    companyId: args.companyId,
    topic: `Scheduling review requested: ${args.teamId}`,
    createdByEmployeeId: authorEmployeeId,
    relatedTaskId: primaryTask?.id,
    visibility: "org",
  });

  await taskStore.createMessage({
    id: newId(`msg_team_sched_review_${args.teamId}`),
    threadId,
    companyId: args.companyId,
    senderEmployeeId: authorEmployeeId,
    receiverTeamId: args.teamId,
    type: "coordination",
    status: "delivered",
    source: "system",
    subject: "Manager review requested for scheduling",
    body: args.recommendation.publicRationale,
    payload: {
      kind: "team_scheduling_review_requested",
      teamId: args.teamId,
      recommendation: args.recommendation,
      schedulingContext: buildSchedulingContext({
        teamId: args.teamId,
        candidates: args.candidates,
      }),
    },
    requiresResponse: true,
    responseActionType: "manager_scheduling_review",
    responseActionStatus: "requested",
    relatedTaskId: primaryTask?.id,
  });
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

async function loadArtifactExpectationsForTask(args: {
  env: OperatorAgentEnv;
  task: Task;
}) {
  const taskStore = getTaskStore(args.env);
  const artifacts = await taskStore.listArtifacts({
    taskId: args.task.id,
    limit: 50,
  });

  return evaluateTaskArtifactExpectations({
    taskType: args.task.taskType,
    artifactTypes: artifacts.map((artifact) => artifact.artifactType),
  });
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
  const candidates = prioritizeCandidates(eligibleTasks, args.teamId);
  const recommendation = await selectTaskWithCognition({
    env: args.env,
    teamId: args.teamId,
    candidates,
  });
  const selected = candidates.find(
    (candidate) => candidate.task.id === recommendation.selectedTaskId,
  );
  const task = selected?.task;

  if (recommendation.recommendation === "request_manager_review") {
    await publishSchedulingReviewThread({
      env: args.env,
      teamId: args.teamId,
      companyId,
      recommendation,
      candidates,
    });

    return {
      ok: true,
      status: "manager_review_requested",
      companyId,
      teamId: args.teamId,
      scanned: {
        pendingTasks: pendingTasks.length,
        eligibleTasks: eligibleTasks.length,
      },
      message: recommendation.publicRationale,
    };
  }

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
      message:
        recommendation.recommendation === "defer"
          ? recommendation.publicRationale
          : `No queued or ready canonical tasks are available for ${args.teamId}.`,
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
      selection: selected ? toSelection(selected) : undefined,
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
      selection: selected ? toSelection(selected) : undefined,
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
    const artifactExpectations = await loadArtifactExpectationsForTask({
      env: args.env,
      task,
    });
    const heartbeat = await publishTeamHeartbeat({
      env: args.env,
      task,
      teamId: args.teamId,
      resolution,
      status: "execution_failed",
      selection: selected ? toSelection(selected) : undefined,
      artifactExpectations,
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
      selection: selected ? toSelection(selected) : undefined,
      heartbeat,
      resolution,
      message,
    };
  }

  const artifactExpectations = await loadArtifactExpectationsForTask({
    env: args.env,
    task,
  });
  const message = `Executed task ${task.id} for ${args.teamId} via ${resolution.employee.identity.employeeId}.`;
  const heartbeat = await publishTeamHeartbeat({
    env: args.env,
    task,
    teamId: args.teamId,
    resolution,
    status: "executed_task",
    selection: selected ? toSelection(selected) : undefined,
    artifactExpectations,
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
    selection: selected ? toSelection(selected) : undefined,
    heartbeat,
    resolution,
    result,
    message,
  };
}