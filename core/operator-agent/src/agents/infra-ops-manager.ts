import { getConfig } from "@aep/operator-agent/config";
import { EmployeeControlStore } from "@aep/operator-agent/lib/employee-control-store";
import { EscalationLog } from "@aep/operator-agent/lib/escalation-log";
import { ManagerDecisionLog } from "@aep/operator-agent/lib/manager-decision-log";
import { listAgentWorkLogEntries } from "@aep/operator-agent/lib/work-log-reader";
import type {
  AgentEmployeeDefinition,
  EmployeeControlRecord,
  EscalationReason,
  ManagedEmployeeObservationSummary,
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
  executionContext?: ResolvedEmployeeRunContext["executionContext"];
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
    executionContext: args.executionContext,
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
  budgetOverride?: EmployeeControlRecord["budgetOverride"];
  authorityOverride?: EmployeeControlRecord["authorityOverride"];
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
    budgetOverride: args.budgetOverride,
    authorityOverride: args.authorityOverride,
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

function escalationId(
  timestamp: string,
  reason: string,
  employeeId: string
): string {
  return `${timestamp}:${reason}:${employeeId}`;
}

function resolveObservedEmployeeIds(
  context: ResolvedEmployeeRunContext,
  config: ReturnType<typeof getConfig>
): string[] {
  if (
    context.request.targetEmployeeIdsOverride &&
    context.request.targetEmployeeIdsOverride.length > 0
  ) {
    return context.request.targetEmployeeIdsOverride;
  }
  if (context.request.targetEmployeeIdOverride) {
    return [context.request.targetEmployeeIdOverride];
  }
  return config.managerObservedEmployeeIds;
}

// Company-origin provenance should come from executionContext, not the
// adapted internal request, so scheduler/source metadata stays consistent
// across logs, escalations, and later approval artifacts.
function companyIdFromExecutionContext(
  executionContext: ResolvedEmployeeRunContext["executionContext"]
): string | undefined {
  return executionContext?.executionSource === "paperclip"
    ? executionContext.companyId
    : undefined;
}

export async function runInfraOpsManager(
  context: ResolvedEmployeeRunContext,
  env?: OperatorAgentEnv
): Promise<ManagerDecisionResponse> {
  const config = getConfig(env);
  const manager = context.employee;
  const nowIso = new Date().toISOString();

  const observedEmployeeIds = resolveObservedEmployeeIds(context, config);

  const decisions: ManagerDecision[] = [];
  const controlStore = new EmployeeControlStore(env ?? {});

  let totalWorkLogEntries = 0;
  let totalVerificationFailed = 0;
  let totalOperatorActionFailed = 0;
  let totalBudgetExhausted = 0;
  let crossWorkerAlerts = 0;
  let escalationsCreated = 0;
  let totalReEnableDecisions = 0;
  let totalRestrictionDecisions = 0;
  let totalClearedRestrictionDecisions = 0;

  const perEmployee: ManagedEmployeeObservationSummary[] = [];

  for (const observedEmployeeId of observedEmployeeIds) {
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

    totalWorkLogEntries += entries.length;
    totalVerificationFailed += verificationFailed;
    totalOperatorActionFailed += operatorActionFailed;
    totalBudgetExhausted += budgetExhausted;

    const currentControl = await controlStore.get(observedEmployeeId);

    let perEmployeeDecisionsStart = decisions.length;

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
          executionContext: context.executionContext,
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
          executionContext: context.executionContext,
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
          executionContext: context.executionContext,
          reason: "frequent_budget_exhaustion",
          recommendation: "recommend_budget_adjustment",
          message:
            "Infra Ops Manager observed repeated budget exhaustion signals and recommends reviewing employee budget settings.",
          windowEntryCount: entries.length,
          resultCounts: counts,
        })
      );

      const message =
        "Infra Ops Manager restricted the employee after repeated budget exhaustion signals in the recent work log window.";

      await controlStore.put(
        buildControlRecord({
          managerEmployeeId: manager.identity.employeeId,
          managerRoleId: manager.identity.roleId,
          employeeId: observedEmployeeId,
          policyVersion: context.policyVersion,
          nowIso,
          state: "restricted",
          transition: "restricted",
          reason: "manager_restricted_after_budget_exhaustion",
          message,
          previousState: currentControl?.state,
          budgetOverride: {
            maxActionsPerScan: 0,
          },
          authorityOverride: {
            allowedTenants: ["dev", "qa", "internal-aep"],
            allowedServices: ["control-plane"],
            requireTraceVerification: true,
          },
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
          executionContext: context.executionContext,
          reason: "employee_restricted_after_budget_exhaustion",
          recommendation: "restrict_employee",
          severity: "warning",
          message,
          windowEntryCount: entries.length,
          resultCounts: counts,
        })
      );

      totalRestrictionDecisions += 1;
    }

    if (
      verificationFailed === 1 &&
      operatorActionFailed === 0 &&
      budgetExhausted < 3
    ) {
      const message =
        "Infra Ops Manager restricted the employee after repeated failure signals, tightening runtime scope without fully disabling the employee.";

      await controlStore.put(
        buildControlRecord({
          managerEmployeeId: manager.identity.employeeId,
          managerRoleId: manager.identity.roleId,
          employeeId: observedEmployeeId,
          policyVersion: context.policyVersion,
          nowIso,
          state: "restricted",
          transition: "restricted",
          reason: "manager_restricted_after_repeated_failures",
          message,
          previousState: currentControl?.state,
          budgetOverride: {
            maxActionsPerScan: 1,
            maxActionsPerHour: 5,
            maxActionsPerTenantPerHour: 2,
          },
          authorityOverride: {
            requireTraceVerification: true,
          },
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
          executionContext: context.executionContext,
          reason: "employee_restricted_after_repeated_failures",
          recommendation: "restrict_employee",
          severity: "warning",
          message,
          windowEntryCount: entries.length,
          resultCounts: counts,
        })
      );

      totalRestrictionDecisions += 1;
    }

    const recentTerminalProblems = verificationFailed + operatorActionFailed;
    const isRestricted = currentControl?.state === "restricted";
    const restrictionReviewReached =
      isRestricted &&
      hasReachedTimeBoundary(currentControl?.reviewAfter, nowIso);

    if (
      currentControl &&
      currentControl.state === "restricted" &&
      recentTerminalProblems === 0 &&
      budgetExhausted === 0 &&
      restrictionReviewReached
    ) {
      const message =
        "Infra Ops Manager cleared employee restrictions after a quiet review window with no recent failures or budget exhaustion.";

      await controlStore.put(
        buildControlRecord({
          managerEmployeeId: manager.identity.employeeId,
          managerRoleId: manager.identity.roleId,
          employeeId: observedEmployeeId,
          policyVersion: context.policyVersion,
          nowIso,
          state: "enabled",
          transition: "restrictions_cleared",
          reason: "manager_restrictions_cleared_after_quiet_period",
          message,
          previousState: currentControl.state,
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
          executionContext: context.executionContext,
          reason: "employee_restrictions_cleared_after_quiet_period",
          recommendation: "clear_employee_restrictions",
          severity: "warning",
          message,
          windowEntryCount: entries.length,
          resultCounts: counts,
        })
      );

      totalClearedRestrictionDecisions += 1;
    }

    perEmployee.push({
      employeeId: observedEmployeeId,
      workLogEntries: entries.length,
      repeatedVerificationFailures: verificationFailed,
      operatorActionFailures: operatorActionFailed,
      budgetExhaustionSignals: budgetExhausted,
      decisionsEmitted: decisions.length - perEmployeeDecisionsStart,
    });
    perEmployeeDecisionsStart = decisions.length;
  }

  // Cross-worker reasoning
  if (totalBudgetExhausted >= 4) {
    decisions.push(
      buildDecision({
        manager: manager.identity,
        employeeId: observedEmployeeIds[0] ?? "unknown",
        policyVersion: context.policyVersion,
        nowIso,
        executionContext: context.executionContext,
        reason: "cross_worker_budget_pressure",
        recommendation: "rebalance_team_capacity",
        severity: "warning",
        message:
          "Infra Ops Manager detected cross-worker budget pressure: combined budget exhaustion signals across the department exceed threshold.",
        windowEntryCount: totalWorkLogEntries,
        resultCounts: {},
      })
    );
    crossWorkerAlerts += 1;
  }

  if (totalVerificationFailed + totalOperatorActionFailed >= 2) {
    decisions.push(
      buildDecision({
        manager: manager.identity,
        employeeId: observedEmployeeIds[0] ?? "unknown",
        policyVersion: context.policyVersion,
        nowIso,
        executionContext: context.executionContext,
        reason: "cross_worker_failure_pattern_detected",
        recommendation: "pause_one_worker_keep_one_active",
        severity: "critical",
        message:
          "Infra Ops Manager detected a correlated failure pattern across workers. Recommend pausing one worker while keeping the other active.",
        windowEntryCount: totalWorkLogEntries,
        resultCounts: {},
      })
    );
    crossWorkerAlerts += 1;
  }

  const log = new ManagerDecisionLog(env ?? {});
  for (const decision of decisions) {
    await log.write(decision);
  }

  const escalationLog = new EscalationLog(env ?? {});
  for (const decision of decisions) {
    const shouldEscalate =
      decision.severity === "critical" ||
      decision.reason === "cross_worker_budget_pressure" ||
      decision.reason === "cross_worker_failure_pattern_detected";
    if (!shouldEscalate) continue;
    const affectedEmployeeIds =
      decision.employeeId === "department"
        ? observedEmployeeIds
        : [decision.employeeId];
    const escalationReasons = new Set<ManagerDecisionReason>([
      "repeated_verification_failures",
      "operator_action_failures_detected",
      "frequent_budget_exhaustion",
      "cross_worker_budget_pressure",
      "cross_worker_failure_pattern_detected",
    ]);
    const rec: EscalationReason = escalationReasons.has(decision.reason)
      ? (decision.reason as EscalationReason)
      : "repeated_verification_failures";
    await escalationLog.write({
      escalationId: escalationId(
        decision.timestamp,
        decision.reason,
        decision.employeeId
      ),
      timestamp: decision.timestamp,
      companyId: companyIdFromExecutionContext(context.executionContext),
      departmentId: decision.departmentId,
      managerEmployeeId: decision.managerEmployeeId,
      managerEmployeeName: decision.managerEmployeeName,
      policyVersion: decision.policyVersion,
      severity: decision.severity,
      state: "open",
      reason: rec,
      affectedEmployeeIds,
      message: decision.message,
      recommendation:
        decision.recommendation === "rebalance_team_capacity" ||
        decision.recommendation === "pause_one_worker_keep_one_active" ||
        decision.recommendation === "recommend_budget_adjustment"
          ? decision.recommendation
          : "escalate_to_human",
      evidence: {
        windowEntryCount: decision.evidence.windowEntryCount,
        resultCounts: decision.evidence.resultCounts,
        perEmployee,
      },
      executionContext: context.executionContext,
    });
    escalationsCreated += 1;
  }

  return {
    ok: true,
    status: "completed",
    policyVersion: context.policyVersion,
    trigger: context.request.trigger,
    employee: manager.identity,
    observedEmployeeIds,
    scanned: {
      workLogEntries: totalWorkLogEntries,
      employeesObserved: observedEmployeeIds.length,
    },
    summary: {
      repeatedVerificationFailures: totalVerificationFailed,
      operatorActionFailures: totalOperatorActionFailed,
      budgetExhaustionSignals: totalBudgetExhausted,
      reEnableDecisions: totalReEnableDecisions,
      restrictionDecisions: totalRestrictionDecisions,
      clearedRestrictionDecisions: totalClearedRestrictionDecisions,
      crossWorkerAlerts,
      escalationsCreated,
      decisionsEmitted: decisions.length,
    },
    perEmployee,
    decisions,
    message:
      decisions.length > 0
        ? "Infra Ops Manager completed a supervisory review and applied local controls where required."
        : "Infra Ops Manager completed a supervisory review and found no escalation-worthy patterns.",
    controlPlaneBaseUrl: config.controlPlaneTarget,
    controlPlaneTarget: config.controlPlaneTarget,
  };
}
