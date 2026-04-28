import type { ExecutionContext } from "@aep/operator-agent/types/execution-provenance";
import type { CompanyId } from "@aep/operator-agent/org/company";
import type { TeamId } from "@aep/operator-agent/org/teams";

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

export type TaskReassignmentReason =
  | "employee_unavailable"
  | "employee_terminated"
  | "employee_retired"
  | "manual_reassignment";

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

export type EmployeePublicLinkType =
  | "github"
  | "linkedin"
  | "website"
  | "x"
  | "portfolio";

export interface EmployeePublicProfile {
  displayName: string;
  bio?: string;
  skills?: string[];
  avatarUrl?: string;
}

export interface EmployeePublicLink {
  type: EmployeePublicLinkType;
  url: string;
  verified: boolean;
  visibility: "public" | "org";
}

export interface EmployeeVisualIdentityPublic {
  birthYear?: number;
  appearanceSummary?: string;
  avatarUrl?: string;
}

export interface EmployeePromptProfile {
  employeeId: string;
  basePrompt: string;
  decisionStyle?: string;
  collaborationStyle?: string;
  identitySeed?: string;
  portraitPrompt?: string;
  promptVersion: string;
  status: "draft" | "approved";
  createdAt: string;
  updatedAt: string;
}

export interface RolePromptProfile {
  roleId: AgentRoleId;
  basePromptTemplate: string;
  decisionStyle?: string;
  collaborationStyle?: string;
  identitySeedTemplate?: string;
  promptVersion: string;
  status: "draft" | "approved";
  createdAt: string;
  updatedAt: string;
}

export interface EmployeePersonaGenerationPublicResult {
  bio?: string;
  tone?: string;
  skills?: string[];
  appearanceSummary?: string;
  birthYear?: number;
  avatarUrl?: string;
}

export interface EmployeePersonaGenerationResult {
  publicProfile: EmployeePersonaGenerationPublicResult;
  promptProfileStatus: "draft" | "approved";
  synthesisMode?: "ai" | "fallback";
  model?: string;
}

export interface EmployeeCognitionStructured {
  intent?: string;
  riskLevel?: "low" | "medium" | "high";
  suggestedNextAction?: string;
}

export type EmployeePublicRationalePresentationStyle =
  | "operational_evidence"
  | "structured_alignment"
  | "conservative_general";

export interface EmployeeProjection {
  identity: {
    employeeId: string;
    companyId: CompanyId;
    teamId: TeamId;
    roleId: AgentRoleId;
  };
  employment: {
    employmentStatus: EmployeeEmploymentStatus;
    schedulerMode: string;
    isSynthetic?: boolean;
  };
  runtime: {
    runtimeStatus: EmployeeRuntimeStatus;
    effectiveState?: {
      state: EmployeeControlState;
      blocked: boolean;
    };
    effectiveBudget?: AgentBudget;
    effectiveAuthority?: AgentAuthority;
  };
  publicProfile?: EmployeePublicProfile;
  publicLinks?: EmployeePublicLink[];
  visualIdentity?: EmployeeVisualIdentityPublic;
  hasCognitiveProfile: boolean;
}

export interface RoleJobDescriptionProjection {
  roleId: AgentRoleId;
  title: string;
  teamId: TeamId;
  employeeIdCode?: string;
  runtimeEnabled?: boolean;
  implementationBinding?: string;
  managerRoleId?: AgentRoleId;
  jobDescriptionText: string;
  responsibilities: string[];
  successMetrics: string[];
  constraints: string[];
  seniorityLevel: string;
  reviewDimensions?: EmployeeReviewDimension[];
}

export interface EmployeeEmploymentEventRecord {
  eventId: string;
  employeeId: string;
  eventType: EmployeeEmploymentEventType;
  fromTeamId?: TeamId;
  toTeamId?: TeamId;
  fromRoleId?: AgentRoleId;
  toRoleId?: AgentRoleId;
  effectiveAt: string;
  reason?: string;
  approvedBy?: string;
  threadId?: string;
  createdAt?: string;
}

export interface TaskReassignmentRecord {
  reassignmentId: string;
  taskId: string;
  fromEmployeeId: string;
  toEmployeeId: string;
  reason: TaskReassignmentReason;
  triggeredByEventId?: string;
  threadId?: string;
  createdAt: string;
}

export type EmployeeReviewRecommendationType =
  | "promote"
  | "coach"
  | "reassign"
  | "restrict"
  | "no_change";

export interface EmployeeReviewDimension {
  key: string;
  label: string;
  description: string;
  weight: number;
}

export interface EmployeeReviewCycleRecord {
  reviewCycleId: string;
  companyId: CompanyId;
  name: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "active" | "closed";
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeePerformanceReviewEvidence {
  evidenceType: "task" | "artifact" | "thread";
  evidenceId: string;
}

export interface EmployeePerformanceRecommendation {
  recommendationType: EmployeeReviewRecommendationType;
  summary: string;
}

export interface EmployeePerformanceReviewRecord {
  reviewId: string;
  reviewCycleId: string;
  employeeId: string;
  roleId: AgentRoleId;
  teamId: TeamId;
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
}

export type CoordinationTaskStatus =
  | "queued"
  | "blocked"
  | "ready"
  | "in_progress"
  | "parked"
  | "completed"
  | "failed"
  | "escalated";

export type EmployeeMessageType = "task" | "escalation" | "coordination";

export type EmployeeMessageStatus = "pending" | "delivered" | "acknowledged";

export type EmployeeMessageSource =
  | "internal"
  | "dashboard"
  | "system"
  | "human"
  | "slack"
  | "email";

export type MessageThreadVisibility = "internal" | "org";

export interface CoordinationTaskRecord {
  id: string;
  companyId: CompanyId;
  originatingTeamId: TeamId;
  assignedTeamId: TeamId;
  ownerEmployeeId?: string;
  assignedEmployeeId?: string;
  createdByEmployeeId?: string;
  taskType: string;
  title: string;
  status: CoordinationTaskStatus;
  payload: Record<string, unknown>;
  blockingDependencyCount: number;
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
}

export interface CoordinationTaskDependencyRecord {
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: "completion";
  createdAt?: string;
}

export interface CoordinationTaskArtifactRecord {
  id: string;
  taskId: string;
  companyId: CompanyId;
  artifactType: "plan" | "result" | "evidence";
  createdByEmployeeId?: string;
  summary?: string;
  content: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface MessageThreadRecord {
  id: string;
  companyId: CompanyId;
  topic: string;
  createdByEmployeeId?: string;
  relatedTaskId?: string;
  relatedArtifactId?: string;
  relatedApprovalId?: string;
  relatedEscalationId?: string;
  visibility: MessageThreadVisibility;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeMessageRecord {
  id: string;
  threadId: string;
  companyId: CompanyId;
  senderEmployeeId: string;
  receiverEmployeeId?: string;
  receiverTeamId?: TeamId;
  type: EmployeeMessageType;
  status: EmployeeMessageStatus;
  source: EmployeeMessageSource;
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
}

export interface MessageThreadDetailRecord {
  thread: MessageThreadRecord;
  messages: EmployeeMessageRecord[];
}

export interface ApprovalDetailWithThreadRecord {
  approval: ApprovalRecord;
  thread?: MessageThreadRecord;
  messages?: EmployeeMessageRecord[];
}

export interface EscalationDetailWithThreadRecord {
  escalation: EscalationRecord;
  thread?: MessageThreadRecord;
  messages?: EmployeeMessageRecord[];
}

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
  | "product-manager"
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

  // Cognitive Plane additions
  bio?: string;        // The agent's biography
  tone?: string;       // The agent's communication tone
  skills?: string[];   // The agent's core competencies
  photoUrl?: string;   // The agent's photo URL
}

export interface OperatorAgentAiBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

export interface AgentAuthority {
  // Validation specialist workflows need remediation and fix proposal actions.
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
  taskId?: string;
  workOrderId?: string; // Legacy compatibility alias
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
  roleCatalogEntry?: RoleJobDescriptionProjection;
  authority: AgentAuthority;
  budget: AgentBudget;
  policyVersion: string;
  executionContext?: ExecutionContext;
  taskContext?: ResolvedTaskExecutionContext;
  effectiveControl?: ResolvedEmployeeControl;
}

export interface ResolvedTaskExecutionContext {
  task: CoordinationTaskRecord;
  dependencies: CoordinationTaskDependencyRecord[];
  artifacts: CoordinationTaskArtifactRecord[];
}

// taskId is the canonical coordination identifier. workOrderId remains only for temporary compatibility.

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
  workOrderId?: string; // Legacy compatibility alias
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
  workOrderId?: string; // Legacy compatibility alias
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

export type ValidationFindingSeverity = "error" | "warning" | "info";

export type ValidationResultStatus = "pass" | "fail" | "warning";

export interface ValidationFinding {
  severity: ValidationFindingSeverity;
  message: string;
  evidence?: string;
}

export interface ValidationResultArtifact extends Record<string, unknown> {
  kind: "validation_result";
  status: ValidationResultStatus;
  summary: string;
  findings: ValidationFinding[];
  targetUrl?: string;
  recommendedNextAction?: string;
  statusCode?: number;
}

export interface ValidationTaskDecision {
  taskId: string;
  taskType: string;
  targetUrl?: string;
  verdict: "pass" | "fail" | "remediate" | "manual_escalation";
  reasoning: string;
  statusCode?: number;
  validationStatus?: ValidationResultStatus;
  recommendedNextAction?: string;
}

export interface ValidationAgentResponse {
  ok: true;
  status: "completed";
  policyVersion: string;
  trigger: EmployeeTrigger;
  employee: AgentIdentity;
  workerRole: "reliability-engineer";
  baseAuthority: AgentAuthority;
  baseBudget: AgentBudget;
  authority: AgentAuthority;
  budget: AgentBudget;
  dryRun: false;
  scanned: {
    tasks: number;
    eligibleTasks: number;
  };
  decisions: ValidationTaskDecision[];
  summary: {
    processed: number;
    passed: number;
    failed: number;
    remediations: number;
    ignored: number;
  };
  message: string;
}

export type WorkerExecutionResponse =
  | EmployeeRunResponse
  | ValidationAgentResponse;

export type AgentExecutionResponse =
  | WorkerExecutionResponse
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
  AI?: OperatorAgentAiBinding;
  CONTROL_PLANE_BASE_URL?: string;
  APP_ENV?: string;
  GIT_SHA?: string;
  SERVICE_NAME?: string;
  AEP_CRON_FALLBACK_ENABLED?: string;
  AEP_AI_ENABLED?: string;
  AEP_AI_MODEL?: string;
  PAPERCLIP_SHARED_SECRET?: string;
  PAPERCLIP_AUTH_REQUIRED?: string;
  ENABLE_TEST_ENDPOINTS?: string;
  MIRROR_DEFAULT_SLACK_CHANNEL?: string;
  MIRROR_APPROVALS_SLACK_CHANNEL?: string;
  MIRROR_ESCALATIONS_SLACK_CHANNEL?: string;
  MIRROR_ESCALATIONS_EMAIL_GROUP?: string;
  SLACK_MIRROR_WEBHOOK_URL?: string;
  CI_CLEANUP_TOKEN?: string;
  GITHUB_TOKEN?: string;
  GITHUB_OWNER?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
}