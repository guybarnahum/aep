import { getConfig } from "@aep/operator-agent/config";
import { EmployeeControlStore } from "@aep/operator-agent/lib/employee-control-store";
import { ManagerDecisionLog } from "@aep/operator-agent/lib/manager-decision-log";
import { listAgentWorkLogEntries } from "@aep/operator-agent/lib/work-log-reader";
import type {
  AgentEmployeeDefinition,
  EmployeeControlRecord,
  ManagerDecision,
  ManagerDecisionReason,
  ManagerDecisionResponse,
  OperatorAgentEnv,
  ResolvedEmployeeRunContext,
  TimeoutRecoveryResult,
} from "@aep/operator-agent/types";

function countResults(
  entries: Array<{ result: TimeoutRecoveryResult }>
): Record<TimeoutRecoveryResult, number> {
  const counts: Partial<Record<TimeoutRecoveryResult, number>> = {};

  for (const entry of entries) {
    counts[entry.result] = (counts[entry.result] ?? 0) + 1;
  }

  return counts as Record<TimeoutRecoveryResult, number>;
}

function buildDecision(args: {
  manager: AgentEmployeeDefinition["identity"];
  employeeId: string;
  policyVersion: string;
  nowIso: string;
  reason: ManagerDecisionReason;
  message: string;
  windowEntryCount: number;
  resultCounts: Partial<Record<TimeoutRecoveryResult, number>>;
  recommendation?: ManagerDecision["recommendation"];
  severity?: ManagerDecision["severity"];
}): ManagerDecision {
  return {
    timestamp: args.nowIso,
    managerEmployeeId: args.manager.employeeId,
    managerEmployeeName: args.manager.employeeName,
    departmentId: args.manager.departmentId,
    roleId: args.manager.roleId,
    policyVersion: args.policyVersion,
    employeeId: args.employeeId,
    reason: args.reason,
    recommendation: args.recommendation ?? "escalate_to_human",
    severity: args.severity ?? "warning",
    message: args.message,
    evidence: {
      windowEntryCount: args.windowEntryCount,
      resultCounts: args.resultCounts,
    },
  };
}

function buildControlRecord(args: {
  managerEmployeeId: string;
  managerRoleId: ManagerDecision["roleId"];
  employeeId: string;
  policyVersion: string;
  nowIso: string;
  state: EmployeeControlRecord["state"];
  transition: EmployeeControlRecord["transition"];
  reason: EmployeeControlRecord["reason"];
  message: string;
  windowEntryCount: number;
  resultCounts: Partial<Record<TimeoutRecoveryResult, number>>;
  previousState?: EmployeeControlRecord["state"];
  reviewAfter?: string;
  expiresAt?: string;
}): EmployeeControlRecord {
  return {
    employeeId: args.employeeId,
    state: args.state,
    transition: args.transition,
    updatedAt: args.nowIso,
    updatedByEmployeeId: args.managerEmployeeId,
    updatedByRoleId: args.managerRoleId,
    policyVersion: args.policyVersion,
    reason: args.reason,
    message: args.message,
    previousState: args.previousState,
    reviewAfter: args.reviewAfter,
    expiresAt: args.expiresAt,
    evidence: {
      windowEntryCount: args.windowEntryCount,
      resultCounts: args.resultCounts,
    },
  };
}

function addMillisecondsToIso(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

function hasReachedTimeBoundary(
  boundaryIso: string | undefined,
  nowIso: string
): boolean {
  return Boolean(boundaryIso && boundaryIso <= nowIso);
}

export async function runInfraOpsManager(
  context: ResolvedEmployeeRunContext,
  env?: OperatorAgentEnv
): Promise<ManagerDecisionResponse> {
  const config = getConfig(env);
  const manager = context.employee;
  const nowIso = new Date().toISOString();

  const observedEmployeeId =
    context.request.targetEmployeeIdOverride ?? "emp_timeout_recovery_01";

  const entries = await listAgentWorkLogEntries({
    env,
    employeeId: observedEmployeeId,
    limit: 100,
  });

  const counts = countResults(entries);
  const verificationFailed = counts.verification_failed ?? 0;
  const operatorActionFailed = counts.operator_action_failed ?? 0;
  const budgetExhausted =
    (counts.skipped_budget_scan_exhausted ?? 0) +
    (counts.skipped_budget_hourly_exhausted ?? 0) +
    (counts.skipped_budget_tenant_hourly_exhausted ?? 0);

  const decisions: ManagerDecision[] = [];
  const controlStore = new EmployeeControlStore(env ?? {});
  const currentControl = await controlStore.get(observedEmployeeId);

  let reEnableDecisions = 0;

  if (verificationFailed >= 2) {
    const message =
      "Infra Ops Manager moved the employee into disabled_pending_review after repeated verification failures in the recent timeout recovery work log window.";

    await controlStore.put(
      buildControlRecord({
        managerEmployeeId: manager.identity.employeeId,
        managerRoleId: manager.identity.roleId,
        employeeId: observedEmployeeId,
        policyVersion: context.policyVersion,
        nowIso,
        state: "disabled_pending_review",
        transition: "disabled",
        reason: "manager_disabled_after_repeated_verification_failures",
        message,
        previousState: currentControl?.state,
        reviewAfter: addMillisecondsToIso(
          nowIso,
          config.managerReviewWindowMs
        ),
        windowEntryCount: entries.length,
        resultCounts: counts,
      })
    );

    decisions.push(
      buildDecision({
        manager: manager.identity,
        employeeId: observedEmployeeId,
        policyVersion: context.policyVersion,
        nowIso,
        reason: "repeated_verification_failures",
        recommendation: "disable_employee",
        severity: "critical",
        message,
        windowEntryCount: entries.length,
        resultCounts: counts,
      })
    );
  }

  if (operatorActionFailed >= 1) {
    const message =
      "Infra Ops Manager moved the employee into disabled_by_manager after operator action failures were observed in the recent timeout recovery work log window.";

    await controlStore.put(
      buildControlRecord({
        managerEmployeeId: manager.identity.employeeId,
        managerRoleId: manager.identity.roleId,
        employeeId: observedEmployeeId,
        policyVersion: context.policyVersion,
        nowIso,
        state: "disabled_by_manager",
        transition: "disabled",
        reason: "manager_disabled_after_operator_action_failures",
        message,
        previousState: currentControl?.state,
        windowEntryCount: entries.length,
        resultCounts: counts,
      })
    );

    decisions.push(
      buildDecision({
        manager: manager.identity,
        employeeId: observedEmployeeId,
        policyVersion: context.policyVersion,
        nowIso,
        reason: "operator_action_failures_detected",
        recommendation: "disable_employee",
        severity: "critical",
        message,
        windowEntryCount: entries.length,
        resultCounts: counts,
      })
    );
  }

  if (budgetExhausted >= 3) {
    decisions.push(
      buildDecision({
        manager: manager.identity,
        employeeId: observedEmployeeId,
        policyVersion: context.policyVersion,
        nowIso,
        reason: "frequent_budget_exhaustion",
        recommendation: "recommend_budget_adjustment",
        message:
          "Infra Ops Manager observed repeated budget exhaustion signals and recommends reviewing employee budget settings.",
        windowEntryCount: entries.length,
        resultCounts: counts,
      })
    );
  }

  const log = new ManagerDecisionLog(env ?? {});
  for (const decision of decisions) {
    await log.write(decision);
  }

  return {
    ok: true,
    status: "completed",
    policyVersion: context.policyVersion,
    trigger: context.request.trigger,
    employee: manager.identity,
    observedEmployeeId,
    scanned: {
      workLogEntries: entries.length,
    },
    summary: {
      repeatedVerificationFailures: verificationFailed,
      operatorActionFailures: operatorActionFailed,
      budgetExhaustionSignals: budgetExhausted,
      reEnableDecisions,
      decisionsEmitted: decisions.length,
    },
    decisions,
    message:
      decisions.length > 0
        ? "Infra Ops Manager completed a supervisory review and applied local controls where required."
        : "Infra Ops Manager completed a supervisory review and found no escalation-worthy patterns.",
    controlPlaneBaseUrl: config.controlPlaneBaseUrl,
  };
}
