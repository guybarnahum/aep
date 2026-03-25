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

export interface EmployeeRunResponse {
  ok: true;
  status: "not_implemented";
  policyVersion: string;
  trigger: EmployeeTrigger;
  employee: AgentIdentity;
  authority: AgentAuthority;
  budget: AgentBudget;
  message: string;
}
