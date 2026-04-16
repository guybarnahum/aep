export type TaskStatus =
  | "queued"
  | "blocked"
  | "ready"
  | "in_progress"
  | "completed"
  | "failed"
  | "escalated";

export type TaskArtifactType = "plan" | "result" | "evidence";

export type TaskVerdict = "pass" | "fail" | "remediate" | "manual_escalation";

export type MessageType = "task" | "escalation" | "coordination";

export type MessageStatus = "pending" | "delivered" | "acknowledged";

export type MessageSource =
  | "internal"
  | "dashboard"
  | "system"
  | "human"
  | "slack"
  | "email";

export type MessageThreadVisibility = "internal" | "org";

export type TaskRecord = {
  id: string;
  companyId: string;
  originatingTeamId: string;
  assignedTeamId: string;
  ownerEmployeeId?: string;
  assignedEmployeeId?: string;
  createdByEmployeeId?: string;
  taskType: string;
  title: string;
  status: TaskStatus;
  payload: Record<string, unknown>;
  blockingDependencyCount: number;
  sourceThreadId?: string;
  sourceMessageId?: string;
  sourceApprovalId?: string;
  sourceEscalationId?: string;
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
};

export type TaskDependency = {
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: "completion";
  createdAt?: string;
};

export type TaskArtifactRecord = {
  id: string;
  taskId: string;
  companyId: string;
  artifactType: TaskArtifactType;
  createdByEmployeeId?: string;
  summary?: string;
  content: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type TaskDecisionRecord = {
  id: string;
  taskId: string;
  employeeId: string;
  verdict: TaskVerdict;
  reasoning: string;
  evidenceTraceId?: string;
  createdAt?: string;
};

export type TaskVisibilitySummary = {
  artifactCounts: {
    plan: number;
    result: number;
    evidence: number;
  };
  hasPlanArtifact: boolean;
  hasPublicRationaleArtifact: boolean;
  publicRationaleArtifactId?: string;
  hasValidationResultArtifact: boolean;
  validationResultArtifactId?: string;
  latestValidationStatus?: string;
  latestDecisionVerdict?: TaskVerdict;
  latestDecisionEmployeeId?: string;
  relatedThreadCount: number;
  relatedApprovalThreadCount: number;
  relatedEscalationThreadCount: number;
};

export type MessageThreadRecord = {
  id: string;
  companyId: string;
  topic: string;
  createdByEmployeeId?: string;
  relatedTaskId?: string;
  relatedArtifactId?: string;
  relatedApprovalId?: string;
  relatedEscalationId?: string;
  visibility: MessageThreadVisibility;
  createdAt?: string;
  updatedAt?: string;
};

export type MirrorDeliveryRecord = {
  id: string;
  messageId: string;
  threadId: string;
  channel: "slack" | "email";
  target: string;
  status: "delivered" | "failed";
  externalMessageId?: string;
  failureCode?: string;
  failureReason?: string;
  createdAt: string;
};

export type EmployeeRuntimeStatus =
  | "implemented"
  | "planned"
  | "disabled";
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
    companyId: string;
    teamId: string;
    roleId: string;
  };
  runtime: {
    runtimeStatus: EmployeeRuntimeStatus;
    effectiveAuthority?: {
      allowedOperatorActions: string[];
      allowedTenants?: string[];
      allowedServices?: string[];
      allowedEnvironmentNames?: string[];
      requireTraceVerification: boolean;
    };
    effectiveBudget?: {
      maxActionsPerScan: number;
      maxActionsPerHour: number;
      maxActionsPerTenantPerHour: number;
      tokenBudgetDaily: number;
      runtimeBudgetMsPerScan: number;
      verificationReadsPerAction: number;
    };
    effectiveState?: {
      state: EmployeeStateValue;
      blocked: boolean;
    };
  };
  publicProfile?: {
    displayName: string;
    bio?: string;
    skills?: string[];
    avatarUrl?: string;
  };
  hasCognitiveProfile: boolean;
};

export type ExternalMessageProjectionRecord = {
  id: string;
  messageId: string;
  threadId: string;
  channel: "slack" | "email";
  target: string;
  externalThreadId: string;
  externalMessageId: string;
  createdAt: string;
};

export type EmployeeMessageRecord = {
  id: string;
  threadId: string;
  companyId: string;
  senderEmployeeId: string;
  receiverEmployeeId?: string;
  receiverTeamId?: string;
  type: MessageType;
  status: MessageStatus;
  source: MessageSource;
  subject?: string;
  body: string;
  payload: Record<string, unknown>;
  externalMessageId?: string;
  externalChannel?: "slack" | "email";
  externalAuthorId?: string;
  externalReceivedAt?: string;
  requiresResponse: boolean;
  responseActionType?: string;
  responseActionStatus?: "requested" | "applied" | "rejected";
  causedStateTransition?: boolean;
  relatedTaskId?: string;
  relatedArtifactId?: string;
  relatedEscalationId?: string;
  relatedApprovalId?: string;
  createdAt?: string;
  updatedAt?: string;
  mirrorDeliveries?: MirrorDeliveryRecord[];
  externalMessageProjections?: ExternalMessageProjectionRecord[];
};

export type ExternalThreadProjectionRecord = {
  id: string;
  threadId: string;
  channel: "slack" | "email";
  target: string;
  externalThreadId: string;
  createdAt: string;
  updatedAt: string;
};

export type ThreadExternalInteractionPolicyRecord = {
  threadId: string;
  inboundRepliesAllowed: boolean;
  externalActionsAllowed: boolean;
  allowedChannels?: Array<"slack" | "email">;
  allowedTargets?: string[];
  allowedExternalActors?: string[];
  createdAt: string;
  updatedAt: string;
};

export type ExternalInteractionAuditRecord = {
  id: string;
  threadId?: string;
  channel: "slack" | "email";
  interactionKind: "reply" | "action";
  externalActorId?: string;
  externalMessageId?: string;
  externalActionId?: string;
  decision: "allowed" | "denied";
  reasonCode: string;
  createdAt: string;
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

export type TaskDetail = {
  ok: boolean;
  task: TaskRecord;
  dependencies: TaskDependency[];
  artifacts: TaskArtifactRecord[];
  decision: TaskDecisionRecord | null;
  relatedThreads: MessageThreadRecord[];
  visibilitySummary: TaskVisibilitySummary;
};

export type ThreadVisibilitySummary = {
  relatedTaskId?: string;
  relatedApprovalId?: string;
  relatedEscalationId?: string;
  messageCount: number;
  hasPublicRationalePublication: boolean;
  latestPublicRationalePresentationStyle?: string;
  approvalActionCount: number;
  escalationActionCount: number;
  externalProjectionCount: number;
  inboundRepliesAllowed?: boolean;
  externalActionsAllowed?: boolean;
};

export type MessageThreadDetail = {
  ok: boolean;
  thread: MessageThreadRecord;
  externalThreadProjections: ExternalThreadProjectionRecord[];
  externalInteractionPolicy: ThreadExternalInteractionPolicyRecord | null;
  externalInteractionAudit: ExternalInteractionAuditRecord[];
  messages: EmployeeMessageRecord[];
  visibilitySummary: ThreadVisibilitySummary;
};

export type WorkOverview = {
  tasks: TaskRecord[];
  threads: MessageThreadRecord[];
};

export type OrgPresenceOverview = {
  employees: OperatorEmployeeRecord[];
  tasks: TaskRecord[];
  threads: MessageThreadRecord[];
  roadmaps: TeamRoadmap[];
  schedulerStatus: SchedulerStatus;
};

export type CreateCanonicalThreadMessageInput = {
  threadId: string;
  body: string;
  subject?: string;
  receiverEmployeeId?: string;
  receiverTeamId?: string;
  relatedTaskId?: string;
  relatedApprovalId?: string;
  relatedEscalationId?: string;
};

export type CreateCanonicalThreadMessageResponse = {
  ok: boolean;
  threadId: string;
  messageId: string;
};

export type MirrorThreadOverview = {
  thread: MessageThreadRecord;
  visibilitySummary: ThreadVisibilitySummary;
  externalThreadProjections: ExternalThreadProjectionRecord[];
  externalInteractionPolicy: ThreadExternalInteractionPolicyRecord | null;
  externalInteractionAudit: ExternalInteractionAuditRecord[];
};

export type ExternalMirrorOverview = {
  threads: MirrorThreadOverview[];
};

export type NarrativeTimelineItem = {
  id: string;
  kind: "task_story" | "approval_story" | "escalation_story" | "thread_story";
  title: string;
  subtitle?: string;
  at: string;
  status?: string;
  employeeId?: string;
  teamId?: string;
  threadId?: string;
  taskId?: string;
  approvalId?: string;
  escalationId?: string;
  summary: string;
  bullets: string[];
};

export type NarrativeTimeline = {
  items: NarrativeTimelineItem[];
};

export type CausalityLink = {
  kind:
    | "source_thread"
    | "source_message"
    | "source_approval"
    | "source_escalation"
    | "related_thread"
    | "approval_thread"
    | "escalation_thread";
  id: string;
  label: string;
  href: string;
};

export type EscalationStateFilter = "all" | "open" | "acknowledged" | "resolved";

export type DecisionSeverityFilter = "all" | "warning" | "critical";

export type EmployeeRuntimeStatusFilter =
  | "all"
  | "implemented"
  | "planned"
  | "disabled";

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
  runtimeStatus: EmployeeRuntimeStatusFilter;
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
