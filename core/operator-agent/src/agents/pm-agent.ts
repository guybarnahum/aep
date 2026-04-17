import { getConfig } from "../config";
import {
  derivePublicRationale,
  thinkWithinEmployeeBoundary,
} from "../lib/employee-cognition";
import { logInfo } from "../lib/logger";
import { createOrgResolver } from "../lib/org-resolver";
import type { OrgCapability } from "../lib/org-resolver";
import { getEmployeePromptProfile } from "../persistence/d1/employee-prompt-profile-store-d1";
import { publishTaskRationaleToThread } from "../lib/rationale-thread-publisher";
import { getTaskStore } from "../lib/store-factory";
import type { MessageThread, Task } from "../lib/store-types";
import type {
  EmployeePublicRationalePresentationStyle,
  ManagerDecision,
  ManagerDecisionResponse,
  OperatorAgentEnv,
  ResolvedEmployeeRunContext,
} from "../types";

type WebsitePlanStep = {
  id: string;
  capability: OrgCapability;
  title: string;
  taskType: string;
  assignedTeamId: string;
  assignedEmployeeId?: string;
  dependsOnStepIds?: string[];
  payload?: Record<string, unknown>;
};

type WebsitePlan = {
  objectiveTitle: string;
  planningTaskTitle: string;
  targetUrl: string;
  steps: WebsitePlanStep[];
};

function publicRationaleArtifactId(taskId: string): string {
  return `art_pubrat_${taskId}_${crypto.randomUUID().split("-")[0]}`;
}

function executionPlanArtifactId(taskId: string): string {
  return `art_plan_${taskId}_${crypto.randomUUID().split("-")[0]}`;
}

function planningThreadId(taskId: string): string {
  return `thr_plan_${taskId}_${crypto.randomUUID().split("-")[0]}`;
}

function planningMessageId(threadId: string): string {
  return `msg_plan_${threadId}_${crypto.randomUUID().split("-")[0]}`;
}

function taskDecisionId(taskId: string, employeeId: string): string {
  return `${taskId}:${employeeId}:${Date.now()}`;
}

async function createPublicRationaleArtifact(args: {
  env: OperatorAgentEnv;
  taskId: string;
  companyId: string;
  employeeId: string;
  presentationStyle: EmployeePublicRationalePresentationStyle;
  summary: string;
  rationale: string;
  recommendedNextAction?: string;
}): Promise<string> {
  const taskStore = getTaskStore(args.env);
  const artifactId = publicRationaleArtifactId(args.taskId);

  await taskStore.createArtifact({
    id: artifactId,
    taskId: args.taskId,
    companyId: args.companyId,
    artifactType: "result",
    createdByEmployeeId: args.employeeId,
    summary: args.summary,
    content: {
      kind: "public_rationale",
      presentationStyle: args.presentationStyle,
      summary: args.summary,
      rationale: args.rationale,
      recommendedNextAction: args.recommendedNextAction,
    },
  });

  return artifactId;
}

function deriveTargetUrl(
  context: ResolvedEmployeeRunContext,
  roadmap: any,
): string {
  const payloadTargetUrl =
    typeof context.taskContext?.task.payload?.targetUrl === "string"
      ? String(context.taskContext?.task.payload?.targetUrl)
      : undefined;

  return payloadTargetUrl ?? "https://staging.aep.internal";
}

function deriveObjectiveTitle(
  context: ResolvedEmployeeRunContext,
  roadmap: any,
): string {
  const payloadObjective =
    typeof context.taskContext?.task.payload?.objectiveTitle === "string"
      ? String(context.taskContext?.task.payload?.objectiveTitle)
      : undefined;

  return payloadObjective ?? roadmap?.objective_title ?? "Website delivery objective";
}

async function buildWebsitePlan(args: {
  context: ResolvedEmployeeRunContext;
  env: OperatorAgentEnv;
  roadmap: any;
}): Promise<WebsitePlan> {
  const objectiveTitle = deriveObjectiveTitle(args.context, args.roadmap);
  const targetUrl = deriveTargetUrl(args.context, args.roadmap);
  const resolver = createOrgResolver(args.env);
  const companyId = args.context.employee.identity.companyId;

  const designOwner = await resolver.resolveTeamForCapability(companyId, "design");
  const implementationOwner = await resolver.resolveTeamForCapability(companyId, "implementation");
  const deploymentOwner = await resolver.resolveTeamForCapability(companyId, "deployment");
  const validationOwner = await resolver.resolveTeamForCapability(companyId, "validation");

  const validationAssignee = await resolver.resolveEmployeeForTask({
    companyId,
    teamId: validationOwner.teamId,
    taskType: "validate-deployment",
  });

  return {
    objectiveTitle,
    planningTaskTitle: `Plan website delivery: ${objectiveTitle}`,
    targetUrl,
    steps: [
      {
        id: "design",
        capability: "design",
        title: `Design website scope for ${objectiveTitle}`,
        taskType: "website-design",
        assignedTeamId: designOwner.teamId,
        payload: {
          objectiveTitle,
          targetUrl,
          phase: "design",
        },
      },
      {
        id: "implement",
        capability: "implementation",
        title: `Implement website for ${objectiveTitle}`,
        taskType: "website-implementation",
        assignedTeamId: implementationOwner.teamId,
        dependsOnStepIds: ["design"],
        payload: {
          objectiveTitle,
          targetUrl,
          phase: "implementation",
        },
      },
      {
        id: "deploy",
        capability: "deployment",
        title: `Deploy website for ${objectiveTitle}`,
        taskType: "website-deployment",
        assignedTeamId: deploymentOwner.teamId,
        dependsOnStepIds: ["implement"],
        payload: {
          objectiveTitle,
          targetUrl,
          phase: "deployment",
        },
      },
      {
        id: "validate",
        capability: "validation",
        title: `Validate website deployment for ${objectiveTitle}`,
        taskType: "validate-deployment",
        assignedTeamId: validationOwner.teamId,
        assignedEmployeeId: validationAssignee.employeeId,
        dependsOnStepIds: ["deploy"],
        payload: {
          objectiveTitle,
          targetUrl,
          phase: "validation",
          useControlPlaneBinding: false,
        },
      },
    ],
  };
}

async function ensurePlanningRootTask(args: {
  env: OperatorAgentEnv;
  context: ResolvedEmployeeRunContext;
  plan: WebsitePlan;
}): Promise<{ task: Task; createdNew: boolean }> {
  const taskStore = getTaskStore(args.env);

  if (args.context.taskContext?.task) {
    const existing = await taskStore.getTask(args.context.taskContext.task.id);
    if (!existing) {
      throw new Error(
        `Planning root task ${args.context.taskContext.task.id} not found`,
      );
    }
    return { task: existing, createdNew: false };
  }

  const planningTaskId = `task_pm_plan_${crypto.randomUUID().split("-")[0]}`;

  await taskStore.createTask({
    id: planningTaskId,
    companyId: args.context.employee.identity.companyId,
    originatingTeamId: args.context.employee.identity.teamId,
    assignedTeamId: args.context.employee.identity.teamId,
    ownerEmployeeId: args.context.employee.identity.employeeId,
    assignedEmployeeId: args.context.employee.identity.employeeId,
    createdByEmployeeId: args.context.employee.identity.employeeId,
    taskType: "plan-website-delivery",
    title: args.plan.planningTaskTitle,
    payload: {
      objectiveTitle: args.plan.objectiveTitle,
      targetUrl: args.plan.targetUrl,
      kind: "website_delivery_plan_root",
    },
  });

  const task = await taskStore.getTask(planningTaskId);
  if (!task) {
    throw new Error(`Failed to load planning root task ${planningTaskId}`);
  }

  return { task, createdNew: true };
}

async function ensurePlanningThread(args: {
  env: OperatorAgentEnv;
  rootTask: Task;
  employeeId: string;
  objectiveTitle: string;
}): Promise<MessageThread> {
  const taskStore = getTaskStore(args.env);

  const existing = await taskStore.listMessageThreads({
    companyId: args.rootTask.companyId,
    relatedTaskId: args.rootTask.id,
    limit: 5,
  });

  if (existing[0]) {
    return existing[0];
  }

  const threadId = planningThreadId(args.rootTask.id);
  await taskStore.createMessageThread({
    id: threadId,
    companyId: args.rootTask.companyId,
    topic: `Planning thread: ${args.objectiveTitle}`,
    createdByEmployeeId: args.employeeId,
    relatedTaskId: args.rootTask.id,
    visibility: "org",
  });

  const thread = await taskStore.getMessageThread(threadId);
  if (!thread) {
    throw new Error(`Failed to load planning thread ${threadId}`);
  }

  return thread;
}

async function createExecutionPlanArtifact(args: {
  env: OperatorAgentEnv;
  rootTask: Task;
  employeeId: string;
  plan: WebsitePlan;
  stepTaskIds: Record<string, string>;
}): Promise<string> {
  const taskStore = getTaskStore(args.env);
  const artifactId = executionPlanArtifactId(args.rootTask.id);

  await taskStore.createArtifact({
    id: artifactId,
    taskId: args.rootTask.id,
    companyId: args.rootTask.companyId,
    artifactType: "plan",
    createdByEmployeeId: args.employeeId,
    summary: `Execution plan for ${args.plan.objectiveTitle}`,
    content: {
      kind: "execution_plan",
      objectiveTitle: args.plan.objectiveTitle,
      targetUrl: args.plan.targetUrl,
      planningTaskId: args.rootTask.id,
      steps: args.plan.steps.map((step) => ({
        id: step.id,
        capability: step.capability,
        title: step.title,
        taskType: step.taskType,
        assignedTeamId: step.assignedTeamId,
        assignedEmployeeId: step.assignedEmployeeId,
        dependsOnStepIds: step.dependsOnStepIds ?? [],
        childTaskId: args.stepTaskIds[step.id],
      })),
    },
  });

  return artifactId;
}

async function createChildTaskGraph(args: {
  env: OperatorAgentEnv;
  context: ResolvedEmployeeRunContext;
  rootTask: Task;
  plan: WebsitePlan;
}): Promise<Record<string, string>> {
  const taskStore = getTaskStore(args.env);
  const stepTaskIds: Record<string, string> = {};

  for (const step of args.plan.steps) {
    stepTaskIds[step.id] = `task_${step.id}_${crypto.randomUUID().split("-")[0]}`;
  }

  for (const step of args.plan.steps) {
    const dependsOnTaskIds = (step.dependsOnStepIds ?? []).map(
      (id) => stepTaskIds[id],
    );

    await taskStore.createTaskWithDependencies({
      task: {
        id: stepTaskIds[step.id],
        companyId: args.context.employee.identity.companyId,
        originatingTeamId: args.context.employee.identity.teamId,
        assignedTeamId: step.assignedTeamId,
        ownerEmployeeId: args.context.employee.identity.employeeId,
        assignedEmployeeId: step.assignedEmployeeId,
        createdByEmployeeId: args.context.employee.identity.employeeId,
        taskType: step.taskType,
        title: step.title,
        payload: {
          ...step.payload,
          planningRootTaskId: args.rootTask.id,
          planningRootTaskTitle: args.rootTask.title,
        },
      },
      dependsOnTaskIds,
    });
  }

  return stepTaskIds;
}

async function createPlanningThreadMessage(args: {
  env: OperatorAgentEnv;
  threadId: string;
  companyId: string;
  employeeId: string;
  rootTaskId: string;
  body: string;
}): Promise<void> {
  const taskStore = getTaskStore(args.env);

  await taskStore.createMessage({
    id: planningMessageId(args.threadId),
    threadId: args.threadId,
    companyId: args.companyId,
    senderEmployeeId: args.employeeId,
    receiverEmployeeId: args.employeeId,
    type: "coordination",
    status: "delivered",
    source: "system",
    subject: "Planning graph created",
    body: args.body,
    payload: {
      kind: "planning_graph_created",
    },
    requiresResponse: false,
    relatedTaskId: args.rootTaskId,
  });
}

async function markPlanningRootCompleted(args: {
  env: OperatorAgentEnv;
  rootTaskId: string;
  employeeId: string;
  reasoning: string;
}): Promise<void> {
  const taskStore = getTaskStore(args.env);

  await taskStore.recordDecision({
    id: taskDecisionId(args.rootTaskId, args.employeeId),
    taskId: args.rootTaskId,
    employeeId: args.employeeId,
    verdict: "pass",
    reasoning: args.reasoning,
  });
}

export async function runPmAgent(
  context: ResolvedEmployeeRunContext,
  env?: OperatorAgentEnv,
): Promise<ManagerDecisionResponse> {
  if (!env) throw new Error("PM Agent requires DB-backed execution");
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("PM Agent requires OPERATOR_AGENT_DB");
  }

  const config = getConfig(env);

  const roadmap = await env.OPERATOR_AGENT_DB.prepare(
    "SELECT * FROM team_roadmaps WHERE status = 'active' ORDER BY priority DESC LIMIT 1",
  ).first<any>();

  let currentRuns: any[] = [];
  try {
    const response = await fetch(`${config.controlPlaneTarget}/runs`);
    if (response.ok) {
      const data = (await response.json()) as { runs: any[] };
      currentRuns = data.runs;
    }
  } catch {
    console.warn(
      "Sense Phase: Could not reach Control Plane. Proceeding with Roadmap context only.",
    );
  }

  const promptProfile = await getEmployeePromptProfile(
    env,
    context.employee.identity.employeeId,
  );

  const cognition = await thinkWithinEmployeeBoundary(
    {
      employee: context.employee.identity,
      promptProfile,
      taskContext: context.taskContext,
      executionContext: context.executionContext,
      observations: [
        `Roadmap objective: ${roadmap?.objective_title ?? "none"}`,
        `Current visible run count: ${currentRuns.length}`,
        "Primary PM responsibility: translate strategic intent into structured execution.",
        "Resolve team ownership by capability instead of hard-coding planning routes in the agent.",
      ],
      additionalContext: {
        roadmap: {
          id: roadmap?.id ?? null,
          title: roadmap?.objective_title ?? null,
          strategicContext: roadmap?.strategic_context ?? null,
          priority: roadmap?.priority ?? null,
          status: roadmap?.status ?? null,
        },
      },
    },
    env,
  );

  const plan = await buildWebsitePlan({
    context,
    env,
    roadmap,
  });

  const root = await ensurePlanningRootTask({
    env,
    context,
    plan,
  });

  const planningThread = await ensurePlanningThread({
    env,
    rootTask: root.task,
    employeeId: context.employee.identity.employeeId,
    objectiveTitle: plan.objectiveTitle,
  });

  const stepTaskIds = await createChildTaskGraph({
    env,
    context,
    rootTask: root.task,
    plan,
  });

  const planArtifactId = await createExecutionPlanArtifact({
    env,
    rootTask: root.task,
    employeeId: context.employee.identity.employeeId,
    plan,
    stepTaskIds,
  });

  const publicRationale = derivePublicRationale(cognition);

  const rationaleArtifactId = await createPublicRationaleArtifact({
    env,
    taskId: root.task.id,
    companyId: context.employee.identity.companyId,
    employeeId: context.employee.identity.employeeId,
    presentationStyle: publicRationale.presentationStyle,
    summary: publicRationale.summary,
    rationale: publicRationale.rationale,
    recommendedNextAction: publicRationale.recommendedNextAction,
  });

  await publishTaskRationaleToThread({
    env,
    companyId: context.employee.identity.companyId,
    taskId: root.task.id,
    artifactId: rationaleArtifactId,
    employeeId: context.employee.identity.employeeId,
    rationale: publicRationale,
  });

  await createPlanningThreadMessage({
    env,
    threadId: planningThread.id,
    companyId: root.task.companyId,
    employeeId: context.employee.identity.employeeId,
    rootTaskId: root.task.id,
    body: [
      `Created canonical execution plan for ${plan.objectiveTitle}.`,
      `Planning root task: ${root.task.id}.`,
      `Plan artifact: ${planArtifactId}.`,
      `Child task count: ${Object.keys(stepTaskIds).length}.`,
      "Ownership was resolved via capability routing.",
    ].join(" "),
  });

  await markPlanningRootCompleted({
    env,
    rootTaskId: root.task.id,
    employeeId: context.employee.identity.employeeId,
    reasoning: `Created planning graph for ${plan.objectiveTitle}.`,
  });

  const now = new Date().toISOString();
  const displayName =
    context.employee.identity.employeeName ?? context.employee.identity.employeeId;
  const publicSummary = cognition.publicSummary?.trim().length
    ? cognition.publicSummary.trim()
    : `Created planning graph for ${plan.objectiveTitle}.`;

  const strategicDecision: ManagerDecision = {
    timestamp: now,
    managerEmployeeId: context.employee.identity.employeeId,
    managerEmployeeName: displayName,
    teamId: context.employee.identity.teamId,
    roleId: context.employee.identity.roleId,
    policyVersion: context.policyVersion,
    employeeId: context.employee.identity.employeeId,
    reason: "frequent_budget_exhaustion",
    recommendation: "rebalance_team_capacity",
    severity: "warning",
    message: publicSummary,
    evidence: {
      windowEntryCount: 1,
      resultCounts: {},
    },
    executionContext: context.executionContext,
  };

  logInfo("pm planning graph created", {
    rootTaskId: root.task.id,
    createdNewRootTask: root.createdNew,
    objectiveTitle: plan.objectiveTitle,
    stepTaskIds,
    stepOwnership: plan.steps.map((step) => ({
      id: step.id,
      capability: step.capability,
      assignedTeamId: step.assignedTeamId,
      assignedEmployeeId: step.assignedEmployeeId,
    })),
    cognitionMode: cognition.mode,
    cognitionIntent: cognition.structured?.intent,
    cognitionRiskLevel: cognition.structured?.riskLevel,
  });

  return {
    ok: true,
    status: "completed",
    policyVersion: context.policyVersion,
    trigger: context.request.trigger,
    employee: context.employee.identity,
    observedEmployeeIds: plan.steps
      .map((step) => step.assignedEmployeeId)
      .filter((value): value is string => typeof value === "string"),
    scanned: {
      workLogEntries: 0,
      employeesObserved: 1,
    },
    summary: {
      repeatedVerificationFailures: 0,
      operatorActionFailures: 0,
      budgetExhaustionSignals: 0,
      reEnableDecisions: 0,
      restrictionDecisions: 0,
      clearedRestrictionDecisions: 0,
      crossWorkerAlerts: 0,
      escalationsCreated: 0,
      approvalsRequested: 0,
      approvalBlockedDecisions: 0,
      approvalAppliedDecisions: 0,
      approvalExpiredBlocks: 0,
      approvalAlreadyExecutedBlocks: 0,
      decisionsEmitted: 1,
    },
    perEmployee: [],
    decisions: [strategicDecision],
    message: `${publicSummary} Planning root ${root.task.id} created with ${Object.keys(stepTaskIds).length} child tasks.`,
    controlPlaneBaseUrl: config.controlPlaneTarget || "",
  };
}
