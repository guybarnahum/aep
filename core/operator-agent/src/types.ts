export type EmployeeTrigger = "manual" | "cron" | "paperclip";

export type DepartmentId = "aep-infra-ops";

export type AgentRoleId =
  | "timeout-recovery-operator"
  | "infra-ops-manager"
  | "retry-supervisor"
  | "teardown-safety-operator"
  | "incident-triage-operator";

export interface AgentIdentity {
  employeeId: string;
  employeeName: string;
  departmentId: DepartmentId;
  roleId: AgentRoleId;
  managerRoleId?: AgentRoleId;
}

export interface AgentAuthority {
  allowedOperatorActions: Array<"advance-timeout">;
  allowedTenants?: string[];
  allowedServices?: string[];
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
  departmentId: DepartmentId;
  employeeId: string;
  roleId: AgentRoleId;
  trigger: EmployeeTrigger;
  policyVersion: string;
  budgetOverride?: Partial<AgentBudget>;
  authorityOverride?: Partial<AgentAuthority>;
  targetEmployeeIdOverride?: string;
}

export interface ResolvedEmployeeRunContext {
  request: EmployeeRunRequest;
  employee: AgentEmployeeDefinition;
  authority: AgentAuthority;
  budget: AgentBudget;
  policyVersion: string;
}

export interface PaperclipRunRequest {
  companyId?: string;
  departmentId: DepartmentId;
  employeeId: string;
  roleId: AgentRoleId;
  policyVersion?: string;
  budgetOverride?: Partial<AgentBudget>;
  authorityOverride?: Partial<AgentAuthority>;
  trigger?: "paperclip";
  taskId?: string;
  heartbeatId?: string;
}

export interface PaperclipRunResponse {
  ok: true;
  status: "completed";
  companyId?: string;
  taskId?: string;
  heartbeatId?: string;
  request: EmployeeRunRequest;
  result: AgentExecutionResponse;
}

export type EmployeeControlState =
  | "enabled"
  | "disabled_pending_review"
  | "disabled_by_manager";

export type EmployeeControlTransition = "disabled" | "re_enabled";

export type EmployeeControlReason =
  | "manager_disabled_after_repeated_verification_failures"
  | "manager_disabled_after_operator_action_failures"
  | "manager_reenabled_after_quiet_period"
  | "manager_reenabled_after_review_window";

export type ManagerDecisionReason =
  | "repeated_verification_failures"
  | "operator_action_failures_detected"
  | "frequent_budget_exhaustion"
  | "employee_reenabled_after_quiet_period";

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
  departmentId: DepartmentId;
  roleId: AgentRoleId;
  policyVersion: string;
  employeeId: string;
  reason: ManagerDecisionReason;
  recommendation:
    | "escalate_to_human"
    | "recommend_budget_adjustment"
    | "recommend_pause_employee"
    | "disable_employee"
    | "re_enable_employee";
  severity: "warning" | "critical";
  message: string;
  evidence: {
    windowEntryCount: number;
    resultCounts: Partial<Record<TimeoutRecoveryResult, number>>;
  };
}

export interface ManagerDecisionResponse {
  ok: true;
  status: "completed";
  policyVersion: string;
  trigger: EmployeeTrigger;
  employee: AgentIdentity;
  observedEmployeeId: string;
  scanned: {
    workLogEntries: number;
  };
  summary: {
    repeatedVerificationFailures: number;
    operatorActionFailures: number;
    budgetExhaustionSignals: number;
    reEnableDecisions: number;
    decisionsEmitted: number;
  };
  decisions: ManagerDecision[];
  message: string;
  controlPlaneBaseUrl: string;
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
  control: EmployeeControlRecord | null;
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
  departmentId: DepartmentId;
  roleId: AgentRoleId;
  policyVersion: string;
  trigger: EmployeeTrigger;
  runId: string;
  jobId: string;
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
}

export interface EmployeeRunResponse {
  ok: true;
  status: "completed";
  policyVersion: string;
  trigger: EmployeeTrigger;
  employee: AgentIdentity;
  authority: AgentAuthority;
  budget: AgentBudget;
  controlPlaneBaseUrl: string;
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
}

export interface OperatorAgentEnv extends Record<string, unknown> {
  OPERATOR_AGENT_KV?: KVNamespace;
}
