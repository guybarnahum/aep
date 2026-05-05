export type TaskStatus =
  | "queued"
  | "blocked"
  | "ready"
  | "parked"
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
  errorMessage?: string;
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

export type EmployeeEmploymentStatus =
  | "draft"
  | "active"
  | "on_leave"
  | "retired"
  | "terminated"
  | "archived";

export type EmployeeEmploymentEventType =
  | "hired"
  | "activated"
  | "reassigned"
  | "role_changed"
  | "went_on_leave"
  | "returned_from_leave"
  | "retired"
  | "terminated"
  | "rehired"
  | "archived";

export type EmployeePublicLink = {
  type: "github" | "linkedin" | "website" | "x" | "portfolio";
  url: string;
  verified: boolean;
  visibility: "public" | "org";
};

export type EmployeeVisualIdentityPublic = {
  birthYear?: number;
  appearanceSummary?: string;
  avatarUrl?: string;
};

export type RuntimeRoleAuthority = {
  allowedOperatorActions: string[];
  allowedTenants?: string[];
  allowedServices?: string[];
  allowedEnvironmentNames?: string[];
  requireTraceVerification: boolean;
};

export type RuntimeRoleBudget = {
  maxActionsPerScan: number;
  maxActionsPerHour: number;
  maxActionsPerTenantPerHour: number;
  tokenBudgetDaily: number;
  runtimeBudgetMsPerScan: number;
  verificationReadsPerAction: number;
};

export type RuntimeRoleEscalationPolicy = {
  onBudgetExhausted: string;
  onRepeatedVerificationFailure: string;
  onProdTenantAction: string;
};

export type RuntimeRolePolicyRecord = {
  roleId: string;
  authority: RuntimeRoleAuthority;
  budget: RuntimeRoleBudget;
  escalation: RuntimeRoleEscalationPolicy;
};

export type RuntimeRolePolicyInput = {
  authority: RuntimeRoleAuthority;
  budget: RuntimeRoleBudget;
  escalation: RuntimeRoleEscalationPolicy;
  updatedBy?: string;
  reason?: string;
};
export type TeamRoadmap = {
  id: string;
  team_id: string;
  objective_title: string;
  strategic_context: string;
  priority: number;
  status: "active" | "completed";
  created_at: string;
};

export type TeamLoopResult = {
  ok: true;
  teamId: string;
  status:
    | "executed_task"
    | "execution_failed"
    | "no_pending_tasks"
    | "waiting_for_staffing";
  taskId?: string;
  employeeId?: string;
  roleId?: string;
  message: string;
  heartbeat?: {
    status: "published" | "skipped_missing_author";
    threadId?: string;
    messageId?: string;
  };
  scanned?: {
    pendingTasks: number;
    eligibleTasks: number;
  };
};

export type TeamLoopRunAllResult = {
  ok: true;
  count: number;
  results: TeamLoopResult[];
};

export type IntakeRequestStatus =
  | "submitted"
  | "triaged"
  | "converted"
  | "rejected";

export type IntakeRequestRecord = {
  id: string;
  companyId: string;
  title: string;
  description?: string | null;
  requestedBy: string;
  source: string;
  status: IntakeRequestStatus;
  createdAt: string;
};

export type ProjectStatus =
  | "active"
  | "paused"
  | "completed"
  | "archived";

export type ProjectRecord = {
  id: string;
  companyId: string;
  intakeRequestId?: string | null;
  createdByEmployeeId?: string | null;
  title: string;
  description?: string | null;
  ownerTeamId: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  archivedAt?: string | null;
  initiativeKind?:
    | "marketing_site"
    | "customer_intake_surface"
    | "tenant_conversion_surface"
    | null;
  productSurface?: "website_bundle" | "customer_intake" | "public_progress" | null;
  externalVisibility?: "internal_only" | "external_safe" | null;
};

export type ProductDeploymentRecord = {
  id: string;
  companyId: string;
  projectId: string;
  sourceTaskId: string;
  sourceArtifactId: string;
  requestedByEmployeeId: string;
  environment: string;
  externalVisibility: "internal_only" | "external_safe";
  status: "requested" | "approved" | "in_progress" | "deployed" | "failed" | "canceled";
  approvalId?: string | null;
  targetUrl?: string | null;
  deploymentTarget: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string | null;
  deployedAt?: string | null;
  failedAt?: string | null;
  canceledAt?: string | null;
};

export type ProductInterventionAction =
  | "add_direction"
  | "request_redesign"
  | "change_priority"
  | "review_validation"
  | "review_deployment_risk"
  | "pause_for_human_review";

export type ProductVisibilitySummary = {
  project: ProjectRecord;
  intake: {
    source?: IntakeRequestRecord | null;
    relatedCustomerIntake: IntakeRequestRecord[];
  };
  tasks: {
    count: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    active: TaskRecord[];
    blocked: TaskRecord[];
    recent: TaskRecord[];
  };
  artifacts: {
    count: number;
    deployable: TaskArtifactRecord[];
    recent: TaskArtifactRecord[];
  };
  deployments: {
    count: number;
    byStatus: Record<string, number>;
    latest: ProductDeploymentRecord[];
  };
  decisions: {
    count: number;
    recent: EmployeeMessageRecord[];
  };
  interventions: {
    pendingApprovalsLikely: boolean;
    suggestedActions: string[];
  };
  approvals: {
    lifecyclePending: ApprovalRecord[];
    lifecycleApproved: ApprovalRecord[];
  };
  staffing: {
    blockers: TaskRecord[];
    staffingBlockers?: ProductStaffingBlocker[];
  };
};

export type ProductInterventionResponse = {
  ok: boolean;
  projectId: string;
  threadId: string;
  messageId: string;
  taskId: string;
};

export type ApprovalMutationResponse = {
  ok: boolean;
  approval?: ApprovalRecord;
  threadId?: string;
};

export type ProductDeploymentExecutionResponse = {
  ok: boolean;
  deployment: ProductDeploymentRecord;
  provider: {
    ok: true;
    provider: "github" | "cloudflare";
    targetUrl?: string | null;
    externalIds: Record<string, string>;
    evidence: Record<string, unknown>;
  };
  threadId: string;
  messageId: string;
};

export type ProductDeploymentCreateResponse = {
  ok: boolean;
  deployment: ProductDeploymentRecord;
  threadId: string;
  messageId: string;
};

export type TutorialFlowStepState = "missing" | "ready" | "blocked" | "done";

export type ProductStaffingBlocker = {
  taskId: string;
  taskTitle: string;
  taskType: string;
  teamId: string;
  roleId?: string;
  errorMessage: string;
};

export type ProductLifecycleAction = "pause" | "resume" | "retire" | "transition";

export type OperatorPermission =
  | "product.lifecycle.request"
  | "product.lifecycle.approve"
  | "product.lifecycle.execute"
  | "deployment.request"
  | "deployment.approve"
  | "deployment.execute"
  | "qa.cleanup"
  | "admin.runtime";

export interface OperatorIdentity {
  operatorId: string;
  email: string;
  name?: string;
  picture?: string;
  provider?: string;
  providerUserId?: string;
  userUuid?: string;
  permissions: OperatorPermission[];
}

export interface AuthMeResponse {
  ok: true;
  operator: OperatorIdentity;
}

export type ProductLifecycleRequestResponse = {
  ok: boolean;
  projectId: string;
  action: ProductLifecycleAction;
  targetStatus: string;
  approvalId: string;
  taskId: string;
  threadId: string;
  messageId: string;
  stateChanged: false;
};

export type ProductLifecycleExecutionResponse = {
  ok: boolean;
  project: ProjectRecord;
  approvalId: string;
  threadId: string;
  messageId: string;
  stateChanged: true;
};

export type ProductSignalRoute = "intake" | "thread";

export type ProductSignalResponse = {
  ok: boolean;
  route: ProductSignalRoute;
  reason: string;
  intakeId?: string;
  threadId?: string;
  messageId?: string;
};

export type ProjectTaskGraphTaskInput = {
  clientTaskId: string;
  title: string;
  taskType: string;
  assignedTeamId: string;
  dependsOnClientTaskIds?: string[];
};

export type CompanyWorkIntakeOverview = {
  intake: IntakeRequestRecord[];
  projects: ProjectRecord[];
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
  employment: {
    employmentStatus: EmployeeEmploymentStatus;
    schedulerMode: string;
    isSynthetic?: boolean;
  };
  publicProfile?: {
    displayName: string;
    bio?: string;
    skills?: string[];
    avatarUrl?: string;
  };
  publicLinks?: EmployeePublicLink[];
  visualIdentity?: EmployeeVisualIdentityPublic;
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
  cadence: {
    teamTickIntervalMinutes: number;
    managerTickIntervalMinutes: number;
    updatedAt: string | null;
    updatedBy: string | null;
    source: "d1" | "env_default";
  };
};

export type ValidationRunType =
  | "runtime_read_safety"
  | "contract_surface"
  | "ownership_surface";

export type ValidationRunMode = "full" | "runtime_only";

export type ValidationRunOrigin = "recurring" | "manual" | "post_deploy" | "dispatch";

export type ValidationRunRecord = {
  validation_run_id: string;
  dispatch_batch_id: string | null;
  validation_type: ValidationRunType;
  requested_by: string;
  assigned_to: string;
  status: "queued" | "running" | "completed" | "failed";
  target_base_url: string;
  origin: ValidationRunOrigin;
  mode: ValidationRunMode;
  result_id: string | null;
  result_status: "passed" | "failed" | "warn" | null;
  result_summary: string | null;
  severity: "info" | "warn" | "failed" | "critical" | null;
  audit_status: "pending" | "reviewed" | null;
  audited_by: string | null;
  audited_at: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type ValidationResultRecord = {
  validation_result_id: string;
  dispatch_batch_id: string | null;
  validation_type: ValidationRunType;
  status: "passed" | "failed" | "warn";
  severity: "info" | "warn" | "failed" | "critical" | null;
  executed_by: string;
  summary: string;
  owner_team: string | null;
  audit_status: "pending" | "reviewed" | null;
  audited_by: string | null;
  audited_at: string | null;
  created_at: string;
  origin: ValidationRunOrigin | null;
  mode: ValidationRunMode | null;
};

export type ValidationSchedulerState = {
  scheduler_name: string;
  paused: boolean;
  pause_reason: string | null;
  paused_by: string | null;
  paused_at: string | null;
  resumed_by: string | null;
  resumed_at: string | null;
  last_run_requested_by: string | null;
  last_run_requested_at: string | null;
  last_dispatch_batch_id: string | null;
  updated_at: string;
};

export type ValidationOverview = {
  team_id: string;
  scheduler: ValidationSchedulerState;
  summary: {
    total_runs: number;
    queued_runs: number;
    running_runs: number;
    completed_runs: number;
    failed_runs: number;
    recurring_runs: number;
    manual_runs: number;
    post_deploy_runs: number;
    latest_run_at: string | null;
    latest_completed_at: string | null;
    latest_result_status: "passed" | "failed" | "warn" | null;
    latest_dispatch_batch_id: string | null;
  };
  recent_runs: ValidationRunRecord[];
  recent_results: ValidationResultRecord[];
};

export type RoleGapReason =
  | "no_active_employee"
  | "required_role_missing"
  | "task_blocked_by_missing_role"
  | "employee_on_leave"
  | "employee_overloaded";

export type RoleGapRecord = {
  kind: "role_gap";
  roleGapId: string;
  companyId: string;
  roleId: string;
  teamId: string;
  reason: RoleGapReason;
  source: Record<string, string>;
  state: "detected" | "acknowledged" | "request_created" | "resolved" | "dismissed";
};

export type StaffingGapOverview = {
  ok: true;
  advisoryOnly: true;
  gaps: RoleGapRecord[];
  summary: {
    roleGaps: number;
    teamMissingRequiredRoles: number;
    taskBlockedByMissingRole: number;
    inactiveOrOnLeaveImpacts: number;
  };
};

export type StaffingRequestState =
  | "draft"
  | "submitted"
  | "approved"
  | "fulfilled"
  | "rejected"
  | "canceled";

export type StaffingRequestRecord = {
  kind: "staffing_request";
  staffingRequestId: string;
  companyId: string;
  roleId: string;
  teamId: string;
  reason: string;
  urgency: "low" | "normal" | "high" | "critical";
  requestedByEmployeeId: string;
  source: Record<string, string>;
  state: StaffingRequestState;
};

export type StaffingOverview = {
  gaps: StaffingGapOverview;
  requests: StaffingRequestRecord[];
};

export type DepartmentOverview = {
  employees: OperatorEmployeeRecord[];
  roles: RoleJobDescriptionProjection[];
  staffingGaps: StaffingGapOverview;
  staffingRequests: StaffingRequestRecord[];
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

export type RoleJobDescriptionProjection = {
  roleId: string;
  title: string;
  teamId: string;
  employeeIdCode?: string;
  runtimeEnabled?: boolean;
  implementationBinding?: string;
  managerRoleId?: string;
  jobDescriptionText: string;
  responsibilities: string[];
  successMetrics: string[];
  constraints: string[];
  seniorityLevel: string;
  reviewDimensions?: EmployeeReviewDimension[];
};

export type EmployeeReviewRecommendationType =
  | "promote"
  | "coach"
  | "reassign"
  | "restrict"
  | "no_change";

export type EmployeeReviewDimension = {
  key: string;
  label: string;
  description: string;
  weight: number;
};

export type EmployeeEmploymentEvent = {
  eventId: string;
  employeeId: string;
  eventType: EmployeeEmploymentEventType;
  fromTeamId?: string;
  toTeamId?: string;
  fromRoleId?: string;
  toRoleId?: string;
  effectiveAt: string;
  reason?: string;
  approvedBy?: string;
  threadId?: string;
  createdAt?: string;
};

export type EmployeeReviewCycleRecord = {
  reviewCycleId: string;
  companyId: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "active" | "closed";
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type EmployeePerformanceReviewEvidence = {
  evidenceType: "task" | "artifact" | "thread";
  evidenceId: string;
};

export type EmployeePerformanceRecommendation = {
  recommendationType: EmployeeReviewRecommendationType;
  summary: string;
};

export type EmployeePerformanceReviewRecord = {
  reviewId: string;
  reviewCycleId: string;
  employeeId: string;
  roleId: string;
  teamId: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  dimensionScores: Array<{
    key: string;
    score: number;
    note?: string;
  }>;
  recommendations: EmployeePerformanceRecommendation[];
  evidence: EmployeePerformanceReviewEvidence[];
  createdBy?: string;
  approvedBy?: string;
  createdAt?: string;
  updatedAt?: string;
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

export type EmployeeControlOverview = {
  ok: boolean;
  employeeId: string;
  control: Record<string, unknown> | null;
  effectiveState: {
    state: "enabled" | "disabled_pending_review" | "disabled_by_manager" | "restricted";
    blocked: boolean;
  };
};

export type EmployeeEffectivePolicyOverview = {
  ok: boolean;
  employeeId: string;
  companyId: string;
  teamId: string;
  status: string;
  implemented: boolean;
  message?: string;
  allowedTenants?: string[];
  allowedServices?: string[];
  allowedEnvironmentNames?: string[];
  baseAuthority?: Record<string, unknown>;
  baseBudget?: Record<string, unknown>;
  effectiveAuthority?: Record<string, unknown>;
  effectiveBudget?: Record<string, unknown>;
  controlState?: {
    state: "enabled" | "disabled_pending_review" | "disabled_by_manager" | "restricted";
    blocked: boolean;
  };
};

export type DelegateTaskFromThreadInput = {
  threadId: string;
  companyId?: string;
  originatingTeamId: string;
  assignedTeamId: string;
  ownerEmployeeId?: string;
  assignedEmployeeId?: string;
  createdByEmployeeId?: string;
  taskType: string;
  title: string;
  payload?: Record<string, unknown>;
  dependsOnTaskIds?: string[];
  sourceMessageId: string;
};

export type DelegateTaskFromThreadResponse = {
  ok: boolean;
  taskId: string;
  threadId: string;
  sourceMessageId: string;
  delegationMessageId: string;
};

export type EmployeeContinuityOverview = {
  employeeId: string;
  activeTasks: TaskRecord[];
  recentTasks: TaskRecord[];
  activeThreads: MessageThreadRecord[];
  recentManagerDecisions: ManagerDecisionRecord[];
  recentControlHistory: ControlHistoryRecord[];
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
