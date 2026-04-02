import { getConfig } from "@aep/operator-agent/config";
import { getApprovalPolicy } from "@aep/operator-agent/lib/approval-policy";
import { createStores } from "@aep/operator-agent/lib/store-factory";
import { listAgentWorkLogEntries } from "@aep/operator-agent/lib/work-log-reader";
import type {
  IApprovalStore,
  IEmployeeControlHistoryStore,
  IEmployeeControlStore,
} from "@aep/operator-agent/lib/store-types";
import type {
  AgentEmployeeDefinition,
  ApprovalRecord,
  EmployeeControlHistoryRecord,
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

function approvalId(
  timestamp: string,
  actionType: string,
  employeeId: string
): string {
  return `approval:${timestamp}:${actionType}:${employeeId}`;
}

function approvalExecutionId(
  timestamp: string,
  actionType: string,
  employeeId: string
): string {
  return `approval-exec:${timestamp}:${actionType}:${employeeId}`;
}

function controlHistoryId(employeeId: string, timestamp: string): string {
  return `${employeeId}:${timestamp}`;
}

function buildApprovalRecord(args: {
  manager: AgentEmployeeDefinition["identity"];
  nowIso: string;
  actionType: string;
  employeeId: string;
  policyVersion: string;
  reason: string;
  message: string;
  executionContext?: ResolvedEmployeeRunContext["executionContext"];
  companyId?: string;
  taskId?: string;
  heartbeatId?: string;
  payload: Record<string, unknown>;
}): ApprovalRecord {
  const policy = getApprovalPolicy(args.actionType);

  return {
    approvalId: approvalId(args.nowIso, args.actionType, args.employeeId),
    timestamp: args.nowIso,
    companyId: args.companyId,
    taskId: args.taskId,
    heartbeatId: args.heartbeatId,
    departmentId: args.manager.departmentId,
    requestedByEmployeeId: args.manager.employeeId,
    requestedByEmployeeName: args.manager.employeeName,
    requestedByRoleId: args.manager.roleId,
    source: "manager",
    actionType: args.actionType,
    payload: args.payload,
    status: "pending",
    expiresAt:
      policy.required && policy.ttlMs > 0
        ? addMillisecondsToIso(args.nowIso, policy.ttlMs)
        : undefined,
    reason: args.reason,
    message: args.message,
    executionContext: args.executionContext,
  };
}

function buildControlHistoryRecord(args: {
  departmentId: EmployeeControlHistoryRecord["departmentId"];
  controlRecord: EmployeeControlRecord;
}): EmployeeControlHistoryRecord {
  return {
    historyId: controlHistoryId(args.controlRecord.employeeId, args.controlRecord.updatedAt),
    timestamp: args.controlRecord.updatedAt,
    employeeId: args.controlRecord.employeeId,
    departmentId: args.departmentId,
    updatedByEmployeeId: args.controlRecord.updatedByEmployeeId,
    updatedByRoleId: args.controlRecord.updatedByRoleId,
    policyVersion: args.controlRecord.policyVersion,
    transition: args.controlRecord.transition,
    previousState: args.controlRecord.previousState,
    nextState: args.controlRecord.state,
    reason: args.controlRecord.reason,
    message: args.controlRecord.message,
    reviewAfter: args.controlRecord.reviewAfter,
    expiresAt: args.controlRecord.expiresAt,
    budgetOverride: args.controlRecord.budgetOverride,
    authorityOverride: args.controlRecord.authorityOverride,
    approvalId: args.controlRecord.approvalId,
    approvalExecutedAt: args.controlRecord.approvalExecutedAt,
    approvalExecutionId: args.controlRecord.approvalExecutionId,
    evidence: args.controlRecord.evidence,
  };
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

function taskIdFromExecutionContext(
  executionContext: ResolvedEmployeeRunContext["executionContext"]
): string | undefined {
  return executionContext?.executionSource === "paperclip"
    ? executionContext.taskId
    : undefined;
}

function heartbeatIdFromExecutionContext(
  executionContext: ResolvedEmployeeRunContext["executionContext"]
): string | undefined {
  return executionContext?.executionSource === "paperclip"
    ? executionContext.heartbeatId
    : undefined;
}

async function applyApprovalBackedControl(args: {
  approvalStore: IApprovalStore;
  controlStore: IEmployeeControlStore;
  controlHistoryStore: IEmployeeControlHistoryStore;
  manager: AgentEmployeeDefinition["identity"];
  employeeId: string;
  policyVersion: string;
  nowIso: string;
  actionType: "disable_employee" | "restrict_employee";
  controlRecord: EmployeeControlRecord;
}): Promise<{
  applied: boolean;
  approvalGateStatus:
    | "blocked_pending_approval"
    | "blocked_rejected"
    | "blocked_expired"
    | "blocked_already_executed"
    | "approved_applied";
  approval?: ApprovalRecord | null;
  executionId?: string;
  approvalExecutedAt?: string;
}> {
  const latest = await args.approvalStore.findLatestDecisionForAction({
    actionType: args.actionType,
    targetEmployeeId: args.employeeId,
  });

  if (!latest || latest.status === "pending") {
    return {
      applied: false,
      approvalGateStatus: "blocked_pending_approval",
      approval: latest,
    };
  }

  if (latest.status === "rejected") {
    return {
      applied: false,
      approvalGateStatus: "blocked_rejected",
      approval: latest,
    };
  }

  if (latest.status === "expired") {
    return {
      applied: false,
      approvalGateStatus: "blocked_expired",
      approval: latest,
    };
  }

  const policy = getApprovalPolicy(args.actionType);
  if (policy.singleUse && (latest.executionId || latest.executedAt)) {
    return {
      applied: false,
      approvalGateStatus: "blocked_already_executed",
      approval: latest,
    };
  }

  const executionId = approvalExecutionId(
    args.nowIso,
    args.actionType,
    args.employeeId
  );
  const approvalExecutedAt = args.nowIso;

  const linkedControlRecord: EmployeeControlRecord = {
    ...args.controlRecord,
    approvalId: latest.approvalId,
    approvalExecutedAt,
    approvalExecutionId: executionId,
  };

  await args.controlStore.put(linkedControlRecord);
  await args.controlHistoryStore.write(
    buildControlHistoryRecord({
      departmentId: args.manager.departmentId,
      controlRecord: linkedControlRecord,
    })
  );

  const marked = await args.approvalStore.markExecuted({
    approvalId: latest.approvalId,
    executedAt: approvalExecutedAt,
    executionId,
    executedByEmployeeId: args.manager.employeeId,
    executedByRoleId: args.manager.roleId,
  });

  if (!marked.ok) {
    if (marked.reason === "already_executed") {
      return {
        applied: false,
        approvalGateStatus: "blocked_already_executed",
        approval: marked.approval ?? latest,
      };
    }

    if (marked.reason === "expired") {
      return {
        applied: false,
        approvalGateStatus: "blocked_expired",
        approval: marked.approval ?? latest,
      };
    }

    return {
      applied: false,
      approvalGateStatus: "blocked_rejected",
      approval: marked.approval ?? latest,
    };
  }

  return {
    applied: true,
    approvalGateStatus: "approved_applied",
    approval: marked.approval,
    executionId,
    approvalExecutedAt,
  };
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
  const stores = createStores(env ?? {});
  const approvalStore = stores.approvals;
  const controlStore = stores.employeeControls;
  const controlHistoryStore = stores.employeeControlHistory;
  const managerDecisionStore = stores.managerDecisions;
  const escalationStore = stores.escalations;

  let totalWorkLogEntries = 0;
  let totalVerificationFailed = 0;
  let totalOperatorActionFailed = 0;
  let totalBudgetExhausted = 0;
  let crossWorkerAlerts = 0;
  let escalationsCreated = 0;
  let approvalsRequested = 0;
  let approvalBlockedDecisions = 0;
  let approvalAppliedDecisions = 0;
  let approvalExpiredBlocks = 0;
  let approvalAlreadyExecutedBlocks = 0;
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
      const latestDisableApproval =
        await approvalStore.findLatestDecisionForAction({
          actionType: "disable_employee",
          targetEmployeeId: observedEmployeeId,
        });
      const disablePolicy = getApprovalPolicy("disable_employee");

      let linkedApproval = latestDisableApproval;
      let approvalGateStatus: ManagerDecision["approvalGateStatus"];
      let appliedExecutionId: string | undefined;
      let appliedExecutedAt: string | undefined;

      const controlRecord = buildControlRecord({
        managerEmployeeId: manager.identity.employeeId,
        managerRoleId: manager.identity.roleId,
        employeeId: observedEmployeeId,
        policyVersion: context.policyVersion,
        nowIso,
        state: "disabled_pending_review",
        transition: "disabled",
        reason: "manager_disabled_after_repeated_verification_failures",
        message:
          "Infra Ops Manager moved the employee into disabled_pending_review after repeated verification failures in the recent timeout recovery work log window.",
        previousState: currentControl?.state,
        reviewAfter: addMillisecondsToIso(nowIso, config.managerReviewWindowMs),
        windowEntryCount: entries.length,
        resultCounts: counts,
      });

      const shouldRequestFreshApproval =
        !latestDisableApproval ||
        latestDisableApproval.status === "expired" ||
        (latestDisableApproval.status === "approved" &&
          disablePolicy.singleUse &&
          Boolean(
            latestDisableApproval.executionId ||
              latestDisableApproval.executedAt
          ));

      if (shouldRequestFreshApproval) {
        linkedApproval = buildApprovalRecord({
          manager: manager.identity,
          nowIso,
          actionType: "disable_employee",
          employeeId: observedEmployeeId,
          policyVersion: context.policyVersion,
          reason: "repeated_verification_failures",
          message:
            "Infra Ops Manager requested approval to move the employee into disabled_pending_review after repeated verification failures in the recent timeout recovery work log window.",
          executionContext: context.executionContext,
          companyId: companyIdFromExecutionContext(context.executionContext),
          taskId: taskIdFromExecutionContext(context.executionContext),
          heartbeatId: heartbeatIdFromExecutionContext(context.executionContext),
          payload: {
            targetEmployeeId: observedEmployeeId,
            requestedState: "disabled_pending_review",
            transition: "disabled",
            controlReason: "manager_disabled_after_repeated_verification_failures",
            reviewAfter: addMillisecondsToIso(nowIso, config.managerReviewWindowMs),
            evidence: {
              windowEntryCount: entries.length,
              resultCounts: counts,
            },
          },
        });
        await approvalStore.write(linkedApproval);
        approvalsRequested += 1;
        approvalGateStatus = "requested_pending";
        approvalBlockedDecisions += 1;
      } else {
        const applyResult = await applyApprovalBackedControl({
          approvalStore,
          controlStore,
          controlHistoryStore,
          manager: manager.identity,
          employeeId: observedEmployeeId,
          policyVersion: context.policyVersion,
          nowIso,
          actionType: "disable_employee",
          controlRecord,
        });
        linkedApproval = applyResult.approval ?? latestDisableApproval;
        approvalGateStatus = applyResult.approvalGateStatus;
        if (approvalGateStatus === "approved_applied") {
          approvalAppliedDecisions += 1;
          appliedExecutionId = applyResult.executionId;
          appliedExecutedAt = applyResult.approvalExecutedAt;
        } else {
          approvalBlockedDecisions += 1;
          if (approvalGateStatus === "blocked_expired") {
            approvalExpiredBlocks += 1;
          }
          if (approvalGateStatus === "blocked_already_executed") {
            approvalAlreadyExecutedBlocks += 1;
          }
        }
      }

      const message =
        approvalGateStatus === "approved_applied"
          ? "Infra Ops Manager applied the approved disable control after repeated verification failures."
          : approvalGateStatus === "blocked_expired"
            ? "Infra Ops Manager found that the prior approval for disabling the employee had expired; control was not applied and fresh approval is required."
            : approvalGateStatus === "blocked_already_executed"
              ? "Infra Ops Manager found that the approved authorization for disabling the employee was already consumed; control was not applied and fresh approval is required."
          : approvalGateStatus === "blocked_rejected"
            ? "Infra Ops Manager found a rejected approval for disabling the employee after repeated verification failures; control was not applied."
            : "Infra Ops Manager requested approval to move the employee into disabled_pending_review after repeated verification failures; action remains blocked pending approval.";

      decisions.push({
        ...buildDecision({
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
        }),
        approvalRequired: true,
        approvalId: linkedApproval?.approvalId,
        approvalStatus: linkedApproval?.status,
        approvalGateStatus,
        approvalExecutionId: appliedExecutionId,
        approvalExecutedAt: appliedExecutedAt,
      });
    }

    if (operatorActionFailed >= 1) {
      const latestDisableApproval =
        await approvalStore.findLatestDecisionForAction({
          actionType: "disable_employee",
          targetEmployeeId: observedEmployeeId,
        });
      const disablePolicy = getApprovalPolicy("disable_employee");

      let linkedApproval = latestDisableApproval;
      let approvalGateStatus: ManagerDecision["approvalGateStatus"];
      let appliedExecutionId: string | undefined;
      let appliedExecutedAt: string | undefined;

      const controlRecord = buildControlRecord({
        managerEmployeeId: manager.identity.employeeId,
        managerRoleId: manager.identity.roleId,
        employeeId: observedEmployeeId,
        policyVersion: context.policyVersion,
        nowIso,
        state: "disabled_by_manager",
        transition: "disabled",
        reason: "manager_disabled_after_operator_action_failures",
        message:
          "Infra Ops Manager moved the employee into disabled_by_manager after operator action failures were observed in the recent timeout recovery work log window.",
        previousState: currentControl?.state,
        windowEntryCount: entries.length,
        resultCounts: counts,
      });

      const shouldRequestFreshApproval =
        !latestDisableApproval ||
        latestDisableApproval.status === "expired" ||
        (latestDisableApproval.status === "approved" &&
          disablePolicy.singleUse &&
          Boolean(
            latestDisableApproval.executionId ||
              latestDisableApproval.executedAt
          ));

      if (shouldRequestFreshApproval) {
        linkedApproval = buildApprovalRecord({
          manager: manager.identity,
          nowIso,
          actionType: "disable_employee",
          employeeId: observedEmployeeId,
          policyVersion: context.policyVersion,
          reason: "operator_action_failures_detected",
          message:
            "Infra Ops Manager requested approval to move the employee into disabled_by_manager after operator action failures were observed in the recent timeout recovery work log window.",
          executionContext: context.executionContext,
          companyId: companyIdFromExecutionContext(context.executionContext),
          taskId: taskIdFromExecutionContext(context.executionContext),
          heartbeatId: heartbeatIdFromExecutionContext(context.executionContext),
          payload: {
            targetEmployeeId: observedEmployeeId,
            requestedState: "disabled_by_manager",
            transition: "disabled",
            controlReason: "manager_disabled_after_operator_action_failures",
            evidence: {
              windowEntryCount: entries.length,
              resultCounts: counts,
            },
          },
        });
        await approvalStore.write(linkedApproval);
        approvalsRequested += 1;
        approvalGateStatus = "requested_pending";
        approvalBlockedDecisions += 1;
      } else {
        const applyResult = await applyApprovalBackedControl({
          approvalStore,
          controlStore,
          controlHistoryStore,
          manager: manager.identity,
          employeeId: observedEmployeeId,
          policyVersion: context.policyVersion,
          nowIso,
          actionType: "disable_employee",
          controlRecord,
        });
        linkedApproval = applyResult.approval ?? latestDisableApproval;
        approvalGateStatus = applyResult.approvalGateStatus;
        if (approvalGateStatus === "approved_applied") {
          approvalAppliedDecisions += 1;
          appliedExecutionId = applyResult.executionId;
          appliedExecutedAt = applyResult.approvalExecutedAt;
        } else {
          approvalBlockedDecisions += 1;
          if (approvalGateStatus === "blocked_expired") {
            approvalExpiredBlocks += 1;
          }
          if (approvalGateStatus === "blocked_already_executed") {
            approvalAlreadyExecutedBlocks += 1;
          }
        }
      }

      const message =
        approvalGateStatus === "approved_applied"
          ? "Infra Ops Manager applied the approved disable control after operator action failures were observed."
          : approvalGateStatus === "blocked_expired"
            ? "Infra Ops Manager found that the prior approval for disabling the employee had expired; control was not applied and fresh approval is required."
            : approvalGateStatus === "blocked_already_executed"
              ? "Infra Ops Manager found that the approved authorization for disabling the employee was already consumed; control was not applied and fresh approval is required."
          : approvalGateStatus === "blocked_rejected"
            ? "Infra Ops Manager found a rejected approval for disabling the employee after operator action failures; control was not applied."
            : "Infra Ops Manager requested approval to move the employee into disabled_by_manager after operator action failures; action remains blocked pending approval.";

      decisions.push({
        ...buildDecision({
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
        }),
        approvalRequired: true,
        approvalId: linkedApproval?.approvalId,
        approvalStatus: linkedApproval?.status,
        approvalGateStatus,
        approvalExecutionId: appliedExecutionId,
        approvalExecutedAt: appliedExecutedAt,
      });
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
        "Infra Ops Manager requested approval to restrict the employee after repeated budget exhaustion signals in the recent work log window.";

      const latestRestrictApproval =
        await approvalStore.findLatestDecisionForAction({
          actionType: "restrict_employee",
          targetEmployeeId: observedEmployeeId,
        });
      const restrictPolicy = getApprovalPolicy("restrict_employee");

      let linkedApproval = latestRestrictApproval;
      let approvalGateStatus: ManagerDecision["approvalGateStatus"];
      let appliedExecutionId: string | undefined;
      let appliedExecutedAt: string | undefined;

      const controlRecord = buildControlRecord({
        managerEmployeeId: manager.identity.employeeId,
        managerRoleId: manager.identity.roleId,
        employeeId: observedEmployeeId,
        policyVersion: context.policyVersion,
        nowIso,
        state: "restricted",
        transition: "restricted",
        reason: "manager_restricted_after_budget_exhaustion",
        message:
          "Infra Ops Manager restricted the employee after repeated budget exhaustion signals in the recent work log window.",
        previousState: currentControl?.state,
        budgetOverride: {
          maxActionsPerScan: 0,
        },
        authorityOverride: {
          allowedTenants: ["dev", "qa", "internal-aep"],
          allowedServices: ["control-plane"],
          requireTraceVerification: true,
        },
        reviewAfter: addMillisecondsToIso(nowIso, config.managerReviewWindowMs),
        windowEntryCount: entries.length,
        resultCounts: counts,
      });

      const shouldRequestFreshApproval =
        !latestRestrictApproval ||
        latestRestrictApproval.status === "expired" ||
        (latestRestrictApproval.status === "approved" &&
          restrictPolicy.singleUse &&
          Boolean(
            latestRestrictApproval.executionId ||
              latestRestrictApproval.executedAt
          ));

      if (shouldRequestFreshApproval) {
        linkedApproval = buildApprovalRecord({
          manager: manager.identity,
          nowIso,
          actionType: "restrict_employee",
          employeeId: observedEmployeeId,
          policyVersion: context.policyVersion,
          reason: "employee_restricted_after_budget_exhaustion",
          message,
          executionContext: context.executionContext,
          companyId: companyIdFromExecutionContext(context.executionContext),
          taskId: taskIdFromExecutionContext(context.executionContext),
          heartbeatId: heartbeatIdFromExecutionContext(context.executionContext),
          payload: {
            targetEmployeeId: observedEmployeeId,
            requestedState: "restricted",
            transition: "restricted",
            controlReason: "manager_restricted_after_budget_exhaustion",
            budgetOverride: {
              maxActionsPerScan: 0,
            },
            authorityOverride: {
              allowedTenants: ["dev", "qa", "internal-aep"],
              allowedServices: ["control-plane"],
              requireTraceVerification: true,
            },
            reviewAfter: addMillisecondsToIso(nowIso, config.managerReviewWindowMs),
            evidence: {
              windowEntryCount: entries.length,
              resultCounts: counts,
            },
          },
        });
        await approvalStore.write(linkedApproval);
        approvalsRequested += 1;
        approvalGateStatus = "requested_pending";
        approvalBlockedDecisions += 1;
      } else {
        const applyResult = await applyApprovalBackedControl({
          approvalStore,
          controlStore,
          controlHistoryStore,
          manager: manager.identity,
          employeeId: observedEmployeeId,
          policyVersion: context.policyVersion,
          nowIso,
          actionType: "restrict_employee",
          controlRecord,
        });
        linkedApproval = applyResult.approval ?? latestRestrictApproval;
        approvalGateStatus = applyResult.approvalGateStatus;
        if (approvalGateStatus === "approved_applied") {
          approvalAppliedDecisions += 1;
          appliedExecutionId = applyResult.executionId;
          appliedExecutedAt = applyResult.approvalExecutedAt;
        } else {
          approvalBlockedDecisions += 1;
          if (approvalGateStatus === "blocked_expired") {
            approvalExpiredBlocks += 1;
          }
          if (approvalGateStatus === "blocked_already_executed") {
            approvalAlreadyExecutedBlocks += 1;
          }
        }
      }

      const restrictedMessage =
        approvalGateStatus === "approved_applied"
          ? "Infra Ops Manager applied the approved restriction control after repeated budget exhaustion signals."
          : approvalGateStatus === "blocked_expired"
            ? "Infra Ops Manager found that the prior approval for restricting the employee had expired; control was not applied and fresh approval is required."
            : approvalGateStatus === "blocked_already_executed"
              ? "Infra Ops Manager found that the approved authorization for restricting the employee was already consumed; control was not applied and fresh approval is required."
          : approvalGateStatus === "blocked_rejected"
            ? "Infra Ops Manager found a rejected approval for restricting the employee after repeated budget exhaustion signals; control was not applied."
            : "Infra Ops Manager requested approval to restrict the employee after repeated budget exhaustion signals; action remains blocked pending approval.";

      decisions.push({
        ...buildDecision({
          manager: manager.identity,
          employeeId: observedEmployeeId,
          policyVersion: context.policyVersion,
          nowIso,
          executionContext: context.executionContext,
          reason: "employee_restricted_after_budget_exhaustion",
          recommendation: "restrict_employee",
          severity: "warning",
          message: restrictedMessage,
          windowEntryCount: entries.length,
          resultCounts: counts,
        }),
        approvalRequired: true,
        approvalId: linkedApproval?.approvalId,
        approvalStatus: linkedApproval?.status,
        approvalGateStatus,
        approvalExecutionId: appliedExecutionId,
        approvalExecutedAt: appliedExecutedAt,
      });

      totalRestrictionDecisions += 1;
    }

    if (
      verificationFailed === 1 &&
      operatorActionFailed === 0 &&
      budgetExhausted < 3
    ) {
      const latestRestrictApproval =
        await approvalStore.findLatestDecisionForAction({
          actionType: "restrict_employee",
          targetEmployeeId: observedEmployeeId,
        });
      const restrictPolicy = getApprovalPolicy("restrict_employee");

      let linkedApproval = latestRestrictApproval;
      let approvalGateStatus: ManagerDecision["approvalGateStatus"];
      let appliedExecutionId: string | undefined;
      let appliedExecutedAt: string | undefined;

      const controlRecord = buildControlRecord({
        managerEmployeeId: manager.identity.employeeId,
        managerRoleId: manager.identity.roleId,
        employeeId: observedEmployeeId,
        policyVersion: context.policyVersion,
        nowIso,
        state: "restricted",
        transition: "restricted",
        reason: "manager_restricted_after_repeated_failures",
        message:
          "Infra Ops Manager restricted the employee after repeated failure signals, tightening runtime scope without fully disabling the employee.",
        previousState: currentControl?.state,
        budgetOverride: {
          maxActionsPerScan: 1,
          maxActionsPerHour: 5,
          maxActionsPerTenantPerHour: 2,
        },
        authorityOverride: {
          requireTraceVerification: true,
        },
        reviewAfter: addMillisecondsToIso(nowIso, config.managerReviewWindowMs),
        windowEntryCount: entries.length,
        resultCounts: counts,
      });

      const shouldRequestFreshApproval =
        !latestRestrictApproval ||
        latestRestrictApproval.status === "expired" ||
        (latestRestrictApproval.status === "approved" &&
          restrictPolicy.singleUse &&
          Boolean(
            latestRestrictApproval.executionId ||
              latestRestrictApproval.executedAt
          ));

      if (shouldRequestFreshApproval) {
        linkedApproval = buildApprovalRecord({
          manager: manager.identity,
          nowIso,
          actionType: "restrict_employee",
          employeeId: observedEmployeeId,
          policyVersion: context.policyVersion,
          reason: "employee_restricted_after_repeated_failures",
          message:
            "Infra Ops Manager requested approval to restrict the employee after repeated failure signals, tightening runtime scope without fully disabling the employee.",
          executionContext: context.executionContext,
          companyId: companyIdFromExecutionContext(context.executionContext),
          taskId: taskIdFromExecutionContext(context.executionContext),
          heartbeatId: heartbeatIdFromExecutionContext(context.executionContext),
          payload: {
            targetEmployeeId: observedEmployeeId,
            requestedState: "restricted",
            transition: "restricted",
            controlReason: "manager_restricted_after_repeated_failures",
            budgetOverride: {
              maxActionsPerScan: 1,
              maxActionsPerHour: 5,
              maxActionsPerTenantPerHour: 2,
            },
            authorityOverride: {
              requireTraceVerification: true,
            },
            reviewAfter: addMillisecondsToIso(nowIso, config.managerReviewWindowMs),
            evidence: {
              windowEntryCount: entries.length,
              resultCounts: counts,
            },
          },
        });
        await approvalStore.write(linkedApproval);
        approvalsRequested += 1;
        approvalGateStatus = "requested_pending";
        approvalBlockedDecisions += 1;
      } else {
        const applyResult = await applyApprovalBackedControl({
          approvalStore,
          controlStore,
          controlHistoryStore,
          manager: manager.identity,
          employeeId: observedEmployeeId,
          policyVersion: context.policyVersion,
          nowIso,
          actionType: "restrict_employee",
          controlRecord,
        });
        linkedApproval = applyResult.approval ?? latestRestrictApproval;
        approvalGateStatus = applyResult.approvalGateStatus;
        if (approvalGateStatus === "approved_applied") {
          approvalAppliedDecisions += 1;
          appliedExecutionId = applyResult.executionId;
          appliedExecutedAt = applyResult.approvalExecutedAt;
        } else {
          approvalBlockedDecisions += 1;
          if (approvalGateStatus === "blocked_expired") {
            approvalExpiredBlocks += 1;
          }
          if (approvalGateStatus === "blocked_already_executed") {
            approvalAlreadyExecutedBlocks += 1;
          }
        }
      }

      const message =
        approvalGateStatus === "approved_applied"
          ? "Infra Ops Manager applied the approved restriction control after repeated failure signals."
          : approvalGateStatus === "blocked_expired"
            ? "Infra Ops Manager found that the prior approval for restricting the employee had expired; control was not applied and fresh approval is required."
            : approvalGateStatus === "blocked_already_executed"
              ? "Infra Ops Manager found that the approved authorization for restricting the employee was already consumed; control was not applied and fresh approval is required."
          : approvalGateStatus === "blocked_rejected"
            ? "Infra Ops Manager found a rejected approval for restricting the employee after repeated failure signals; control was not applied."
            : "Infra Ops Manager requested approval to restrict the employee after repeated failure signals; action remains blocked pending approval.";

      decisions.push({
        ...buildDecision({
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
        }),
        approvalRequired: true,
        approvalId: linkedApproval?.approvalId,
        approvalStatus: linkedApproval?.status,
        approvalGateStatus,
        approvalExecutionId: appliedExecutionId,
        approvalExecutedAt: appliedExecutedAt,
      });

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

      const clearedControlRecord = buildControlRecord({
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
        });

      await controlStore.put(clearedControlRecord);
      await controlHistoryStore.write(
        buildControlHistoryRecord({
          departmentId: manager.identity.departmentId,
          controlRecord: clearedControlRecord,
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

  for (const decision of decisions) {
    await managerDecisionStore.write(decision);
  }

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
    await escalationStore.write({
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
      approvalsRequested,
      approvalBlockedDecisions,
      approvalAppliedDecisions,
      approvalExpiredBlocks,
      approvalAlreadyExecutedBlocks,
      decisionsEmitted: decisions.length,
    },
    perEmployee,
    decisions,
    message:
      decisions.length > 0
        ? "Infra Ops Manager completed a supervisory review and requested approvals or applied local controls where required."
        : "Infra Ops Manager completed a supervisory review and found no escalation-worthy patterns.",
    controlPlaneBaseUrl: config.controlPlaneTarget,
    controlPlaneTarget: config.controlPlaneTarget,
  };
}
