export type TeamRoadmap = {
  id: string;
  team_id: string;
  objective_title: string;
  strategic_context: string;
  priority: number;
  status: "active" | "completed";
  created_at: string;
};
export type RunSummary = {
  run_id: string;
  tenant_id: string;
  project_id: string;
  service_name: string;
  environment_name: string;
  repo_url: string | null;
  branch: string | null;
  provider: string | null;
  status: "running" | "waiting" | "completed" | "failed";
  current_step: string | null;
  logical_job_type: string | null;
  logical_job_status: "waiting" | "running" | "completed" | "failed" | null;
  active_attempt: number | null;
  latest_failure_kind: string | null;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
  trace_id: string | null;
  trace_path: string;
};

export type TenantSummary = {
  tenant_id: string;
  name: string;
  service_count: number;
  environment_count: number;
  is_internal: boolean;
  source?: "seeded" | "observed";
};

export type ServiceSummary = {
  tenant_id: string;
  service_id: string;
  service_name: string;
  provider: string | null;
  environments: string[];
};

export type TenantOverview = {
  tenant: TenantSummary;
  services: Array<{
    tenant_id: string;
    service_id: string;
    service_name: string;
    provider: string | null;
    environments: Array<{
      environment_name: string;
      latest_run: RunSummary | null;
    }>;
  }>;
};

export type ServiceOverview = {
  tenant: TenantSummary;
  service: ServiceSummary;
  environments: Array<{
    environment_name: string;
    latest_run: RunSummary | null;
    recent_runs: RunSummary[];
  }>;
};

export type EmployeeStateValue =
  | "enabled"
  | "disabled_pending_review"
  | "disabled_by_manager"
  | "restricted";

export type OperatorEmployeeRecord = {
  identity: {
    employeeId: string;
    employeeName: string;
    departmentId: string;
    roleId: string;
    managerRoleId?: string;
    bio?: string;
    tone?: string;
    skills?: string[];
    photoUrl?: string;
  };
  authority: {
    allowedOperatorActions: string[];
    allowedTenants?: string[];
    allowedServices?: string[];
    requireTraceVerification: boolean;
  };
  budget: {
    maxActionsPerScan: number;
    maxActionsPerHour: number;
    maxActionsPerTenantPerHour: number;
    tokenBudgetDaily: number;
    runtimeBudgetMsPerScan: number;
    verificationReadsPerAction: number;
  };
  effectiveAuthority: {
    allowedOperatorActions: string[];
    allowedTenants?: string[];
    allowedServices?: string[];
    requireTraceVerification: boolean;
  };
  effectiveBudget: {
    maxActionsPerScan: number;
    maxActionsPerHour: number;
    maxActionsPerTenantPerHour: number;
    tokenBudgetDaily: number;
    runtimeBudgetMsPerScan: number;
    verificationReadsPerAction: number;
  };
  escalation: {
    onBudgetExhausted: string;
    onRepeatedVerificationFailure: string;
    onProdTenantAction: string;
  };
  effectiveState?: {
    state: EmployeeStateValue;
    blocked: boolean;
  };
  catalog?: {
    companyId: string;
    teamId: string;
    status: string;
    schedulerMode: string;
    implemented: boolean;
  };
  scope?: {
    allowedTenants?: string[];
    allowedServices?: string[];
    allowedEnvironmentNames?: string[];
  };
  message?: string;
  governance: {
    companyPrimaryEntryPoint: string;
    cronFallbackEnabled: boolean;
    escalationRoute: string;
    controlHistoryRoute: string;
  };
};

export type ManagerDecisionRecord = {
  timestamp: string;
  managerEmployeeId: string;
  managerEmployeeName: string;
  departmentId: string;
  roleId: string;
  policyVersion: string;
  employeeId: string;
  reason: string;
  recommendation: string;
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
    resultCounts: Record<string, number>;
  };
  executionContext?: {
    executionSource?: string;
    companyId?: string;
    taskId?: string;
    heartbeatId?: string;
    executorId?: string;
    internalMonologue?: string;
  };
};

export type EscalationRecord = {
  escalationId: string;
  timestamp: string;
  companyId?: string;
  departmentId: string;
  managerEmployeeId: string;
  managerEmployeeName: string;
  policyVersion: string;
  severity: "warning" | "critical";
  state: "open" | "acknowledged" | "resolved";
  reason: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  affectedEmployeeIds: string[];
  message: string;
  recommendation: string;
  evidence: {
    windowEntryCount: number;
    resultCounts?: Record<string, number>;
    perEmployee?: Array<{
      employeeId: string;
      workLogEntries: number;
      repeatedVerificationFailures: number;
      operatorActionFailures: number;
      budgetExhaustionSignals: number;
    }>;
  };
  executionContext?: {
    executionSource?: string;
    companyId?: string;
    taskId?: string;
    heartbeatId?: string;
    executorId?: string;
  };
};

export type ControlHistoryRecord = {
  historyId: string;
  timestamp: string;
  employeeId: string;
  departmentId: string;
  updatedByEmployeeId: string;
  updatedByRoleId: string;
  policyVersion: string;
  transition: string;
  previousState?: string;
  nextState: string;
  reason: string;
  message: string;
  reviewAfter?: string;
  expiresAt?: string;
  budgetOverride?: Record<string, unknown>;
  authorityOverride?: Record<string, unknown>;
  approvalId?: string;
  approvalExecutedAt?: string;
  approvalExecutionId?: string;
  evidence?: {
    windowEntryCount: number;
    resultCounts?: Record<string, number>;
  };
};

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export type ApprovalRecord = {
  approvalId: string;
  timestamp: string;
  companyId?: string;
  taskId?: string;
  heartbeatId?: string;
  departmentId: string;
  requestedByEmployeeId: string;
  requestedByEmployeeName?: string;
  requestedByRoleId: string;
  source: "manager" | "policy" | "system";
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
  executedByRoleId?: string;
  executionContext?: {
    executionSource?: string;
    companyId?: string;
    taskId?: string;
    heartbeatId?: string;
    executorId?: string;
  };
};

export type SchedulerStatus = {
  primaryScheduler: string;
  cronFallbackEnabled: boolean;
};

export type DepartmentOverview = {
  employees: OperatorEmployeeRecord[];
  escalations: EscalationRecord[];
  controlHistory: ControlHistoryRecord[];
  managerLog: ManagerDecisionRecord[];
  approvals: ApprovalRecord[];
  roadmaps: TeamRoadmap[];
  schedulerStatus: SchedulerStatus;
};

export type EscalationStateFilter = "all" | "open" | "acknowledged" | "resolved";

export type DecisionSeverityFilter = "all" | "warning" | "critical";

export type EmployeeStateFilter =
  | "all"
  | "enabled"
  | "disabled_pending_review"
  | "disabled_by_manager"
  | "restricted";

export type ApprovalStatusFilter =
  | "all"
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

export type ApprovalActionFilter =
  | "all"
  | "disable_employee"
  | "restrict_employee";

export type DepartmentFilters = {
  selectedEmployeeId: string | null;
  escalationState: EscalationStateFilter;
  decisionSeverity: DecisionSeverityFilter;
  employeeState: EmployeeStateFilter;
  approvalStatus: ApprovalStatusFilter;
  approvalAction: ApprovalActionFilter;
};

export type EscalationMutationResponse = {
  ok: boolean;
  escalation?: EscalationRecord;
};

export type PageSize = 10 | 20 | 50;

export type SectionPaginationState = {
  page: number;
  pageSize: PageSize;
};

export type DepartmentPaginationState = {
  employees: SectionPaginationState;
  escalations: SectionPaginationState;
  managerLog: SectionPaginationState;
  controlHistory: SectionPaginationState;
  approvals: SectionPaginationState;
};
