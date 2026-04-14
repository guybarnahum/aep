import { getConfig } from "../config";
import {
  derivePublicRationale,
  thinkWithinEmployeeBoundary,
} from "../lib/employee-cognition";
import { logInfo } from "../lib/logger";
import { getEmployeePromptProfile } from "../lib/employee-prompt-profile-store-d1";
import { getTaskStore } from "../lib/store-factory";
import type {
  ManagerDecision,
  ManagerDecisionResponse,
  OperatorAgentEnv,
  ResolvedEmployeeRunContext,
} from "../types";

const TEAM_WEB_PRODUCT = "team_web_product";
const TEAM_VALIDATION = "team_validation";
const VALIDATION_EMPLOYEE_ID = "emp_val_specialist_01";

function publicRationaleArtifactId(taskId: string): string {
  return `art_pubrat_${taskId}_${crypto.randomUUID().split("-")[0]}`;
}

async function createPublicRationaleArtifact(args: {
  env: OperatorAgentEnv;
  taskId: string;
  companyId: string;
  employeeId: string;
  summary: string;
  rationale: string;
  recommendedNextAction?: string;
}): Promise<void> {
  const taskStore = getTaskStore(args.env);

  await taskStore.createArtifact({
    id: publicRationaleArtifactId(args.taskId),
    taskId: args.taskId,
    companyId: args.companyId,
    artifactType: "result",
    createdByEmployeeId: args.employeeId,
    summary: args.summary,
    content: {
      kind: "public_rationale",
      summary: args.summary,
      rationale: args.rationale,
      recommendedNextAction: args.recommendedNextAction,
    },
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

  const taskStore = getTaskStore(env);
  const config = getConfig(env);

  // 1. SENSE: Query the roadmap and current runs
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

  if (!roadmap) {
    throw new Error("No active roadmap objective found for PM Agent.");
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
        `Roadmap objective: ${roadmap.objective_title}`,
        `Current visible run count: ${currentRuns.length}`,
        "Primary PM responsibility: translate strategic intent into structured execution.",
      ],
      additionalContext: {
        roadmap: {
          id: roadmap.id ?? null,
          title: roadmap.objective_title,
          strategicContext: roadmap.strategic_context ?? null,
          priority: roadmap.priority ?? null,
          status: roadmap.status ?? null,
        },
      },
    },
    env,
  );

  // 2. ACT
  const taskId = `task_pm_${crypto.randomUUID().split("-")[0]}`;

  await taskStore.createTask({
    id: taskId,
    companyId: context.employee.identity.companyId,

    // PR6C coordination semantics:
    // originatingTeamId = who asked for the work
    // assignedTeamId    = who is responsible for executing it
    originatingTeamId: context.employee.identity.teamId ?? TEAM_WEB_PRODUCT,
    assignedTeamId: TEAM_VALIDATION,

    ownerEmployeeId: context.employee.identity.employeeId,
    assignedEmployeeId: VALIDATION_EMPLOYEE_ID,
    createdByEmployeeId: context.employee.identity.employeeId,

    taskType: "validate-deployment",
    title: "Validate staging deployment health",
    payload: {
      targetUrl: "https://staging.aep.internal",
      reason: roadmap.objective_title,
      currentRunCount: currentRuns.length,
      roadmapId: roadmap.id ?? null,
    },
  });

  const publicRationale = derivePublicRationale(cognition);

  await createPublicRationaleArtifact({
    env,
    taskId,
    companyId: context.employee.identity.companyId,
    employeeId: context.employee.identity.employeeId,
    summary: publicRationale.summary,
    rationale: publicRationale.rationale,
    recommendedNextAction: publicRationale.recommendedNextAction,
  });

  // 4. GENERATE COMPLIANT RESPONSE
  const now = new Date().toISOString();
  const displayName =
    context.employee.identity.employeeName ?? context.employee.identity.employeeId;
  const publicSummary = cognition.publicSummary?.trim().length
    ? cognition.publicSummary.trim()
    : `Delegated validation task ${taskId} based on objective: ${roadmap.objective_title}`;

  const strategicDecision: ManagerDecision = {
    timestamp: now,
    managerEmployeeId: context.employee.identity.employeeId,
    managerEmployeeName: displayName,
    teamId: context.employee.identity.teamId,
    roleId: context.employee.identity.roleId,
    policyVersion: context.policyVersion,
    employeeId: VALIDATION_EMPLOYEE_ID,
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

  logInfo("strategic task created", {
    taskId,
    objective: roadmap.objective_title,
    originatingTeamId: context.employee.identity.teamId,
    assignedTeamId: TEAM_VALIDATION,
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
    observedEmployeeIds: [VALIDATION_EMPLOYEE_ID],
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
    message: `${publicSummary} Task ${taskId} created.`,
    controlPlaneBaseUrl: config.controlPlaneTarget || "",
  };
}