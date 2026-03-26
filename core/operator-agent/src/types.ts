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
}

export interface ResolvedEmployeeRunContext {
  request: EmployeeRunRequest;
  employee: AgentEmployeeDefinition;
  authority: AgentAuthority;
  budget: AgentBudget;
  policyVersion: string;
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
