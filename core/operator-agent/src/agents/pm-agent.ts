import { getTaskStore } from "../lib/store-factory";
import { logInfo } from "../lib/logger";
import { getConfig } from "../config";
import type {
  OperatorAgentEnv,
  ResolvedEmployeeRunContext,
  ManagerDecisionResponse,
  ManagerDecision
} from "../types";

export async function runPmAgent(
  context: ResolvedEmployeeRunContext,
  env?: OperatorAgentEnv
): Promise<ManagerDecisionResponse> {
  if (!env) throw new Error("PM Agent requires DB-backed execution");
  const taskStore = getTaskStore(env);
  const config = getConfig(env);


  // 1. SENSE: Query the Roadmap and Current Runs
  const roadmap = await env.OPERATOR_AGENT_DB!.prepare(
    "SELECT * FROM team_roadmaps WHERE status = 'active' ORDER BY priority DESC LIMIT 1"
  ).first<any>();

  // Sensing Phase: Try to fetch current runs from the control plane
  let currentRuns = [];
  try {
    const response = await fetch(`${env.CONTROL_PLANE_TARGET}/runs`);
    if (response.ok) {
      const data = await response.json();
      currentRuns = data.runs;
    }
  } catch (e) {
    // Log the warning, but DON'T crash. Marcus can still plan based on the Roadmap alone.
    console.warn("Sense Phase: Could not reach Control Plane. Proceeding with Roadmap context only.");
  }

  if (!roadmap) {
    throw new Error("No active roadmap objective found for PM Agent.");
  }

  // 2. THINK: Deliberate on Strategy
  const thought = `Roadmap objective: \"${roadmap.objective_title}\". \nTargeting staging baseline. Creating a validation task to verify current deploy health.`;

  // 3. ACT: Create the Task
  const taskId = `task_pm_${crypto.randomUUID().split('-')[0]}`;
  await taskStore.createTask({
    id: taskId,
    companyId: context.employee.identity.companyId,
    teamId: 'team_validation',
    taskType: 'validate-deployment',
    payload: {
      targetUrl: 'https://staging.aep.internal',
      reason: roadmap.objective_title
    }
  });

  // 4. GENERATE COMPLIANT RESPONSE
  const now = new Date().toISOString();
  const strategicDecision: ManagerDecision = {
    timestamp: now,
    managerEmployeeId: context.employee.identity.employeeId,
    managerEmployeeName: context.employee.identity.employeeName,
    teamId: context.employee.identity.teamId,
    roleId: context.employee.identity.roleId,
    policyVersion: context.policyVersion,
    employeeId: 'team_validation', // Target of the delegation
    reason: "frequent_budget_exhaustion", // Reusing enum: closest semantic fit for "Strategic Rebalance"
    recommendation: "rebalance_team_capacity",
    severity: "warning",
    message: `Delegated validation task ${taskId} based on objective: ${roadmap.objective_title}`,
    evidence: {
      windowEntryCount: 1,
      resultCounts: {}
    },
    executionContext: {
      ...context.executionContext,
      internalMonologue: thought
    } as any
  };

  logInfo("strategic task created", { taskId, objective: roadmap.objective_title });

  return {
    ok: true,
    status: "completed",
    policyVersion: context.policyVersion,
    trigger: context.request.trigger,
    employee: context.employee.identity,
    observedEmployeeIds: ['emp_val_specialist_01'],
    scanned: {
      workLogEntries: 0,
      employeesObserved: 1
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
      decisionsEmitted: 1
    },
    perEmployee: [],
    decisions: [strategicDecision],
    message: `Strategic objective "${roadmap.objective_title}" processed. Task ${taskId} created.`,
    controlPlaneBaseUrl: config.controlPlaneTarget || ""
  };
}
