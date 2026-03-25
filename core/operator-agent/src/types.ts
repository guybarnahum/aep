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

export interface TimeoutRecoveryDryRunDecision {
  runId: string;
  jobId: string;
  tenant?: string;
  service?: string;
  jobType?: string;
  jobStatus?: string;
  action: "would-advance-timeout";
  mode: "dry-run";
  eligible: boolean;
  reason: CandidateReason;
}

export interface EmployeeRunResponse {
  ok: true;
  status: "dry_run_completed";
  policyVersion: string;
  trigger: EmployeeTrigger;
  employee: AgentIdentity;
  authority: AgentAuthority;
  budget: AgentBudget;
  controlPlaneBaseUrl: string;
  scanned: {
    runs: number;
    jobs: number;
  };
  candidates: TimeoutRecoveryDryRunDecision[];
  message: string;
}
