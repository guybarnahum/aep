import type { ExecutionContext } from "@aep/operator-agent/types/execution-provenance";
import type { CompanyId } from "@aep/operator-agent/org/company";
import type { TeamId } from "@aep/operator-agent/org/teams";

export type EmployeeTrigger = "manual" | "cron" | "paperclip";

export type EscalationSeverity = "warning" | "critical";

export type EscalationState = "open" | "acknowledged" | "resolved";

// lifecycle invariants:
//
// open → acknowledged → resolved
//
// - no backward transitions
// - no implicit transitions
// - all transitions are explicit via operator API

export type EscalationReason =
  | "repeated_verification_failures"
  | "operator_action_failures_detected"
  | "frequent_budget_exhaustion"
  | "cross_worker_budget_pressure"
  | "cross_worker_failure_pattern_detected";

export type AgentRoleId =
  | "timeout-recovery-operator"
  | "infra-ops-manager"
  | "retry-supervisor"
  | "teardown-safety-operator"
  | "incident-triage-operator"
  | "product-manager-web"
  | "frontend-engineer"
  | "validation-pm"
  | "validation-engineer"
  | "reliability-engineer";

export interface AgentIdentity {
  employeeId: string;
  employeeName: string;
  companyId: CompanyId;
  teamId: TeamId;
  roleId: AgentRoleId;
  managerRoleId?: AgentRoleId;
}

export interface AgentAuthority {
  allowedOperatorActions: Array<
    "advance-timeout" |
    "execute-remediation" |
    "propose-fix"
  >;
  allowedTenants?: string[];
  allowedServices?: string[];
  allowedEnvironmentNames?: string[];
  requireTraceVerification: boolean;
}

export interface AgentBudget {
  maxActionsPerScan: number;
  maxActionsPerHour: number;
  maxActionsPerTenantPerHour: number;
  tokenBudgetDaily: number;
  runtimeBudgetMsPerScan: number;
  verificationReadsPerAction: number;
}

export interface EscalationPolicy {
  onBudgetExhausted: "log" | "notify-human" | "notify-manager";
  onRepeatedVerificationFailure: "notify-human" | "disable-agent";
  onProdTenantAction: "allow" | "require-manager-approval";
}

export interface AgentEmployeeDefinition {
  identity: AgentIdentity;
  authority: AgentAuthority;
  budget: AgentBudget;
  escalation: EscalationPolicy;
}

export interface EmployeeRunRequest {
  companyId?: string;
  teamId?: TeamId;
  tenantId?: string;
  serviceId?: string;
  environmentName?: string;
  employeeId: string;
  roleId: AgentRoleId;
  trigger: EmployeeTrigger;
  policyVersion: string;
  budgetOverride?: Partial<AgentBudget>;
  authorityOverride?: Partial<AgentAuthority>;
  targetEmployeeIdOverride?: string;
  targetEmployeeIdsOverride?: string[];
  workflowKind?: string;
  requestedBy?: string;
  workerId?: string;
}

export interface ResolvedEmployeeRunContext {
  request: EmployeeRunRequest;
  employee: AgentEmployeeDefinition;
  authority: AgentAuthority;
  budget: AgentBudget;
  policyVersion: string;
  executionContext?: ExecutionContext;
}

export interface PaperclipRunRequest {
  companyId: string;
  teamId?: TeamId;
  employeeId: string;
  roleId: AgentRoleId;
  policyVersion?: string;
  budgetOverride?: Partial<AgentBudget>;
  authorityOverride?: Partial<AgentAuthority>;
  trigger?: "paperclip";
  taskId: string;
  heartbeatId: string;
  workflowKind?: string;
  requestedBy?: string;
  workerId?: string;
  input?: Record<string, unknown>;
  targetEmployeeIdOverride?: string;
  targetEmployeeIdsOverride?: string[];
}

export interface PaperclipRunResponse {
  ok: true;
  status: "completed";
  companyId: string;
  taskId: string;
  heartbeatId: string;
  request: EmployeeRunRequest;
  result: AgentExecutionResponse;
  executionSource: "paperclip";
  cronFallbackRecommended: boolean;
  executionContext?: ExecutionContext;
}

export type EmployeeControlState =
  | "enabled"
  | "disabled_pending_review"
  | "disabled_by_manager"
  | "restricted";

export type EmployeeControlTransition =
  | "disabled"
  | "re_enabled"
  | "restricted"
  | "restrictions_cleared";

export type EmployeeControlReason =
  | "manager_disabled_after_repeated_verification_failures"
  | "manager_disabled_after_operator_action_failures"
  | "manager_reenabled_after_quiet_period"
  | "manager_reenabled_after_review_window"
  | "manager_restricted_after_budget_exhaustion"
  | "manager_restricted_after_repeated_failures"
  | "manager_restrictions_cleared_after_quiet_period";

export type ManagerDecisionReason =
  | "repeated_verification_failures"
  | "operator_action_failures_detected"
  | "frequent_budget_exhaustion"
  | "employee_reenabled_after_quiet_period"
  | "employee_restricted_after_budget_exhaustion"
  | "employee_restricted_after_repeated_failures"
  | "employee_restrictions_cleared_after_quiet_period"
  | "cross_worker_budget_pressure"
  | "cross_worker_failure_pattern_detected";

export type CandidateReason =
  | "eligible_timeout_recovery"
  | "not_timeout_eligible"
  | "tenant_not_allowed"
  | "service_not_allowed";

export type TimeoutRecoveryMode = "dry-run" | "apply";

export type TimeoutRecoveryResult =
  | "skipped_not_eligible"
  | "skipped_tenant_not_allowed"
  | "skipped_service_not_allowed"
  | "skipped_budget_scan_exhausted"
  | "skipped_budget_hourly_exhausted"
  | "skipped_budget_tenant_hourly_exhausted"
  | "skipped_cooldown_active"
  | "action_requested"
  | "verified_applied"
  | "verification_failed"
  | "operator_action_failed";

export interface ManagerDecision {
  timestamp: string;
  managerEmployeeId: string;
  managerEmployeeName: string;
  teamId: TeamId;
  roleId: AgentRoleId;
  policyVersion: string;
  employeeId: string;
  reason: ManagerDecisionReason;
  recommendation:
    | "escalate_to_human"
    | "recommend_budget_adjustment"
    | "recommend_pause_employee"
    | "disable_employee"
    | "re_enable_employee"
    | "restrict_employee"
    | "clear_employee_restrictions"
    | "rebalance_team_capacity"
    | "pause_one_worker_keep_one_active";
  severity: "warning" | "critical";
  message: string;
  approvalRequired?: boolean;
  approvalId?: string;
  approvalStatus?: ApprovalStatus;
  approvalGateStatus?:
    | "not_required"
    | "requested_pending"
    | "blocked_pending_approval"
    | "blocked_rejected"
    | "blocked_expired"
    | "blocked_already_executed"
    | "approved_ready"
    | "approved_applied";
  approvalExecutionId?: string;
  approvalExecutedAt?: string;
  evidence: {
    windowEntryCount: number;
    resultCounts: Partial<Record<TimeoutRecoveryResult, number>>;
  };
  executionContext?: ExecutionContext;
}

export interface ManagedEmployeeObservationSummary {
  employeeId: string;
  workLogEntries: number;
  repeatedVerificationFailures: number;
  operatorActionFailures: number;
  budgetExhaustionSignals: number;
  decisionsEmitted: number;
}

export interface ManagerDecisionResponse {
  ok: true;
  status: "completed";
  policyVersion: string;
  trigger: EmployeeTrigger;
  employee: AgentIdentity;
  observedEmployeeIds: string[];
  scanned: {
    workLogEntries: number;
    employeesObserved: number;
  };
  summary: {
    repeatedVerificationFailures: number;
    operatorActionFailures: number;
    budgetExhaustionSignals: number;
    reEnableDecisions: number;
    restrictionDecisions: number;
    clearedRestrictionDecisions: number;
    crossWorkerAlerts: number;
    escalationsCreated: number;
    approvalsRequested: number;
    approvalBlockedDecisions: number;
    approvalAppliedDecisions: number;
    approvalExpiredBlocks: number;
    approvalAlreadyExecutedBlocks: number;
    decisionsEmitted: number;
  };
  perEmployee: ManagedEmployeeObservationSummary[];
  decisions: ManagerDecision[];
  message: string;
  controlPlaneBaseUrl: string;
  controlPlaneTarget?: string;
}

export interface EscalationRecord {
  escalationId: string;
  timestamp: string;
  companyId?: string;
  teamId: TeamId;
  managerEmployeeId: string;
  managerEmployeeName: string;
  policyVersion: string;
  severity: EscalationSeverity;
  state: EscalationState;
  reason: EscalationReason;

  // lifecycle transition fields
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  affectedEmployeeIds: string[];
  message: string;
  recommendation:
    | "escalate_to_human"
    | "recommend_budget_adjustment"
    | "rebalance_team_capacity"
    | "pause_one_worker_keep_one_active";
  evidence: {
    windowEntryCount: number;
    resultCounts?: Partial<Record<TimeoutRecoveryResult, number>>;
    perEmployee?: Array<{
      employeeId: string;
      workLogEntries: number;
      repeatedVerificationFailures: number;
      operatorActionFailures: number;
      budgetExhaustionSignals: number;
    }>;
  };
  executionContext?: ExecutionContext;
}

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

export type ApprovalSource = "manager" | "policy" | "system";

export interface ApprovalPolicy {
  required: boolean;
  ttlMs: number;
  singleUse: boolean;
}

export interface ApprovalPolicyResolved {
  actionType: string;
  required: boolean;
  ttlMs: number;
  singleUse: boolean;
}

export interface ApprovalRecord {
  approvalId: string;
  timestamp: string;
  companyId?: string;
  taskId?: string;
  heartbeatId?: string;

  teamId: TeamId;

  requestedByEmployeeId: string;
  requestedByEmployeeName?: string;
  requestedByRoleId: AgentRoleId;
  source: ApprovalSource;

  actionType: string;
  payload: Record<string, unknown>;

  status: ApprovalStatus;
  expiresAt?: string;

  reason: string;
  message: string;

  decidedAt?: string;
  decidedBy?: string;
  decisionNote?: string;
  executedAt?: string;
  executionId?: string;
  executedByEmployeeId?: string;
  executedByRoleId?: AgentRoleId;

  executionContext?: ExecutionContext;
}

export interface EmployeeControlHistoryRecord {
  historyId: string;
  timestamp: string;
  employeeId: string;
  teamId: TeamId;
  updatedByEmployeeId: string;
  updatedByRoleId: AgentRoleId;
  policyVersion: string;
  transition: EmployeeControlTransition;
  previousState?: EmployeeControlState;
  nextState: EmployeeControlState;
  reason: EmployeeControlReason;
  message: string;
  reviewAfter?: string;
  expiresAt?: string;
  budgetOverride?: Partial<AgentBudget>;
  authorityOverride?: Partial<AgentAuthority>;
  approvalId?: string;
  approvalExecutedAt?: string;
  approvalExecutionId?: string;
  evidence?: {
    windowEntryCount: number;
    resultCounts?: Partial<Record<TimeoutRecoveryResult, number>>;
  };
}

export interface CompanyRunMetadata {
  companyId?: string;
  heartbeatId?: string;
  taskId?: string;
  source: "paperclip" | "cron";
}

export interface EmployeeControlRecord {
  employeeId: string;
  state: EmployeeControlState;
  transition: EmployeeControlTransition;
  updatedAt: string;
  updatedByEmployeeId: string;
  updatedByRoleId: AgentRoleId;
  policyVersion: string;
  reason: EmployeeControlReason;
  message: string;
  previousState?: EmployeeControlState;
  reviewAfter?: string;
  expiresAt?: string;
  budgetOverride?: Partial<AgentBudget>;
  authorityOverride?: Partial<AgentAuthority>;
  approvalId?: string;
  approvalExecutedAt?: string;
  approvalExecutionId?: string;
  evidence?: {
    windowEntryCount: number;
    resultCounts?: Partial<Record<TimeoutRecoveryResult, number>>;
  };
}

export interface ResolvedEmployeeControl {
  employeeId: string;
  state: EmployeeControlState;
  blocked: boolean;
  reviewAfter?: string;
  expiresAt?: string;
  budgetOverride?: Partial<AgentBudget>;
  authorityOverride?: Partial<AgentAuthority>;
  control: EmployeeControlRecord | null;
}

export interface EffectiveEmployeePolicy {
  authority: AgentAuthority;
  budget: AgentBudget;
  control: ResolvedEmployeeControl;
}

export interface EmployeeControlBlockedResponse {
  ok: true;
  status: "skipped_disabled_by_manager" | "skipped_pending_review";
  policyVersion: string;
  trigger: EmployeeTrigger;
  employee: AgentIdentity;
  message: string;
  control: EmployeeControlRecord;
}

export interface RunSummary {
  id: string;
  tenant?: string;
  service?: string;
  status?: string;
}

export interface JobSummary {
  id: string;
  run_id: string;
  job_type?: string;
  status?: string;
  failure_kind?: string | null;
  operator_actions?: {
    can_advance_timeout?: boolean;
  };
}

export interface BudgetSnapshot {
  actionsUsedThisScan: number;
  actionsUsedThisHour: number;
  tenantActionsUsedThisHour: number;
}

export interface TraceEvent {
  type: string;
  job_id?: string;
  run_id?: string;
  attempt_id?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface TimeoutRecoveryDecision {
  runId: string;
  jobId: string;
  tenant?: string;
  service?: string;
  jobType?: string;
  jobStatus?: string;
  action: "advance-timeout";
  mode: TimeoutRecoveryMode;
  eligible: boolean;
  reason: CandidateReason;
  result: TimeoutRecoveryResult;
  budgetSnapshot?: BudgetSnapshot;
  traceEvidence?: string[];
  errorMessage?: string;
}

export interface AgentWorkLogEntry {
  timestamp: string;
  employeeId: string;
  employeeName: string;
  companyId: CompanyId;
  teamId: TeamId;
  roleId: AgentRoleId;
  policyVersion: string;
  trigger: EmployeeTrigger;
  runId: string;
  jobId: string;
  tenantId?: string;
  serviceId?: string;
  environmentName?: string;
  tenant?: string;
  service?: string;
  action: "advance-timeout";
  mode: TimeoutRecoveryMode;
  eligible: boolean;
  reason: CandidateReason;
  result: TimeoutRecoveryResult;
  budgetSnapshot: BudgetSnapshot;
  traceEvidence?: string[];
  errorMessage?: string;
  executionContext?: ExecutionContext;
}

export interface EmployeeRunResponse {
  ok: true;
  status: "completed";
  policyVersion: string;
  trigger: EmployeeTrigger;
  employee: AgentIdentity;
  workerRole: "timeout-recovery-operator" | "retry-supervisor";
  baseAuthority: AgentAuthority;
  baseBudget: AgentBudget;
  authority: AgentAuthority;
  budget: AgentBudget;
  controlPlaneBaseUrl: string;
  controlPlaneTarget?: string;
  dryRun: boolean;
  scanned: {
    runs: number;
    jobs: number;
  };
  decisions: TimeoutRecoveryDecision[];
  summary: {
    eligible: number;
    skipped: number;
    actionRequested: number;
    verifiedApplied: number;
    verificationFailed: number;
    operatorActionFailed: number;
    skippedBudgetScanExhausted: number;
    skippedBudgetHourlyExhausted: number;
    skippedBudgetTenantHourlyExhausted: number;
    skippedCooldownActive: number;
  };
  message: string;
}

export type AgentExecutionResponse =
  | EmployeeRunResponse
  | ManagerDecisionResponse
  | EmployeeControlBlockedResponse;

export interface EmployeeRunErrorResponse {
  ok: false;
  status:
    | "invalid_request"
    | "employee_not_found"
    | "role_mismatch"
    | "control_plane_unavailable";
  error: string;
  policyVersion?: string;
  controlPlaneBaseUrl?: string;
  controlPlaneTarget?: string;
}

export interface OperatorAgentEnv extends Record<string, unknown> {
  OPERATOR_AGENT_DB?: D1Database;
  OPERATOR_AGENT_STORE_BACKEND?: string;
  CONTROL_PLANE?: Fetcher;
  CONTROL_PLANE_BASE_URL?: string;
  APP_ENV?: string;
  GIT_SHA?: string;
  SERVICE_NAME?: string;
  AEP_CRON_FALLBACK_ENABLED?: string;
  PAPERCLIP_SHARED_SECRET?: string;
  PAPERCLIP_AUTH_REQUIRED?: string;
  ENABLE_TEST_ENDPOINTS?: string;
}
