import { getTaskStore } from "../lib/store-factory";
import { logInfo } from "../lib/logger";
import { getConfig } from "../config";
import type {
  OperatorAgentEnv,
  ResolvedEmployeeRunContext,
  ManagerDecisionResponse,
  ManagerDecision,
} from "../types";

const TEAM_WEB_PRODUCT = "team_web_product";
const TEAM_VALIDATION = "team_validation";
const VALIDATION_EMPLOYEE_ID = "emp_val_specialist_01";

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

  // 2. THINK
  const thought =
    `Roadmap objective: "${roadmap.objective_title}". ` +
    `Targeting staging baseline. Creating a validation task to verify current deploy health.`;

  // 3. ACT
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

  // 4. GENERATE COMPLIANT RESPONSE
  const now = new Date().toISOString();
  const displayName =
    context.employee.identity.employeeName ?? context.employee.identity.employeeId;

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
    message: `Delegated validation task ${taskId} based on objective: ${roadmap.objective_title}`,
    evidence: {
      windowEntryCount: 1,
      resultCounts: {},
    },
    executionContext: {
      ...context.executionContext,
      internalMonologue: thought,
    } as any,
  };

  logInfo("strategic task created", {
    taskId,
    objective: roadmap.objective_title,
    originatingTeamId: context.employee.identity.teamId,
    assignedTeamId: TEAM_VALIDATION,
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
    message: `Strategic objective "${roadmap.objective_title}" processed. Task ${taskId} created.`,
    controlPlaneBaseUrl: config.controlPlaneTarget || "",
  };
}