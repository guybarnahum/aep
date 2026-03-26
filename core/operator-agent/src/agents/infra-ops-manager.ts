import { getConfig } from "@aep/operator-agent/config";
import { ManagerDecisionLog } from "@aep/operator-agent/lib/manager-decision-log";
import { listAgentWorkLogEntries } from "@aep/operator-agent/lib/work-log-reader";
import type {
  AgentEmployeeDefinition,
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
    severity: "warning",
    message: args.message,
    evidence: {
      windowEntryCount: args.windowEntryCount,
      resultCounts: args.resultCounts,
    },
  };
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

  if (verificationFailed >= 2) {
    decisions.push(
      buildDecision({
        manager: manager.identity,
        employeeId: observedEmployeeId,
        policyVersion: context.policyVersion,
        nowIso,
        reason: "repeated_verification_failures",
        recommendation: "escalate_to_human",
        message:
          "Infra Ops Manager observed repeated verification failures in the recent timeout recovery work log window.",
        windowEntryCount: entries.length,
        resultCounts: counts,
      })
    );
  }

  if (operatorActionFailed >= 1) {
    decisions.push(
      buildDecision({
        manager: manager.identity,
        employeeId: observedEmployeeId,
        policyVersion: context.policyVersion,
        nowIso,
        reason: "operator_action_failures_detected",
        recommendation: "escalate_to_human",
        message:
          "Infra Ops Manager observed operator action failures in the recent timeout recovery work log window.",
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
      decisionsEmitted: decisions.length,
    },
    decisions,
    message:
      decisions.length > 0
        ? "Infra Ops Manager completed an advisory review and emitted supervisory decisions."
        : "Infra Ops Manager completed an advisory review and found no escalation-worthy patterns.",
    controlPlaneBaseUrl: config.controlPlaneBaseUrl,
  };
}