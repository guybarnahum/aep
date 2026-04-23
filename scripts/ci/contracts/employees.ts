export type EmployeeRuntimeStatus = "implemented" | "planned" | "disabled";

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

export type EmployeeControlState =
  | "enabled"
  | "disabled_pending_review"
  | "disabled_by_manager"
  | "restricted";

export type EmployeeIdentity = {
  employeeId: string;
  roleId: string;
  companyId: string;
  teamId: string;
};

export type EmployeeAuthority = {
  allowedTenants?: string[];
  allowedServices?: string[];
  allowedEnvironmentNames?: string[];
  requireTraceVerification?: boolean;
  [key: string]: unknown;
};

export type EmployeeBudget = {
  maxActionsPerScan?: number;
  [key: string]: unknown;
};

export type EffectiveState = {
  state: EmployeeControlState;
  blocked: boolean;
};

export type EmployeePublicProfile = {
  displayName: string;
  bio?: string;
  skills?: string[];
  avatarUrl?: string;
};

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

export type EmployeeEmploymentProjection = {
  employmentStatus: EmployeeEmploymentStatus;
  schedulerMode: string;
  isSynthetic?: boolean;
};

export type EmployeeProjection = {
  identity: EmployeeIdentity;
  employment: EmployeeEmploymentProjection;
  runtime: {
    runtimeStatus: EmployeeRuntimeStatus;
    effectiveAuthority?: EmployeeAuthority;
    effectiveBudget?: EmployeeBudget;
    effectiveState?: EffectiveState;
  };
  publicProfile?: EmployeePublicProfile;
  publicLinks?: EmployeePublicLink[];
  visualIdentity?: EmployeeVisualIdentityPublic;
  hasCognitiveProfile: boolean;
};

export type EmployeesListResponse = {
  ok: true;
  count: number;
  employees: EmployeeProjection[];
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

export type RolesListResponse = {
  ok: true;
  count: number;
  roles: RoleJobDescriptionProjection[];
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

export type EmployeeEmploymentEventsResponse = {
  ok: true;
  employeeId: string;
  count: number;
  events: EmployeeEmploymentEvent[];
};

export type TaskReassignment = {
  reassignmentId: string;
  taskId: string;
  fromEmployeeId: string;
  toEmployeeId: string;
  reason: string;
  triggeredByEventId?: string;
  threadId?: string;
  createdAt: string;
};

export type EmployeePersonaGenerationPublicResult = {
  bio?: string;
  tone?: string;
  skills?: string[];
  appearanceSummary?: string;
  birthYear?: number;
  avatarUrl?: string;
};

export type EmployeePersonaGenerationResponse = {
  ok: true;
  employeeId: string;
  generated: {
    publicProfile: EmployeePersonaGenerationPublicResult;
    promptProfileStatus: "draft" | "approved";
    synthesisMode?: "ai" | "fallback";
    model?: string;
  };
};

export type EmployeePersonaApprovalResponse = {
  ok: true;
  employeeId: string;
  promptProfileStatus: "draft" | "approved";
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

export type ReviewCyclesListResponse = {
  ok: true;
  count: number;
  reviewCycles: EmployeeReviewCycleRecord[];
};

export type ReviewCycleCreateResponse = {
  ok: true;
  reviewCycle: EmployeeReviewCycleRecord;
};

export type EmployeeReviewsListResponse = {
  ok: true;
  employeeId: string;
  count: number;
  reviews: EmployeePerformanceReviewRecord[];
};

export type EmployeeReviewCreateResponse = {
  ok: true;
  employeeId: string;
  review: EmployeePerformanceReviewRecord;
};

export type PurgeSyntheticEmployeeResponse = {
  ok: boolean;
  employeeId: string;
  employeeName?: string;
  employmentStatus?: EmployeeEmploymentStatus;
  purged?: boolean;
  error?: string;
};

export type EmployeeScopeResponse = {
  ok: true;
  employeeId: string;
  companyId: string;
  teamId: string;
  status: string;
  schedulerMode: string;
  allowedTenants: string[];
  allowedServices: string[];
  allowedEnvironmentNames: string[];
  scopeBindings: unknown[];
};

export type EmployeeEffectivePolicyResponse = {
  ok: true;
  employeeId: string;
  companyId: string;
  teamId: string;
  status: string;
  implemented: boolean;
  allowedTenants?: string[];
  allowedServices?: string[];
  allowedEnvironmentNames?: string[];
  message?: string;
  baseAuthority?: EmployeeAuthority;
  baseBudget?: EmployeeBudget;
  effectiveAuthority?: EmployeeAuthority;
  effectiveBudget?: EmployeeBudget;
  controlState?: EffectiveState;
};

export type EmployeeControl = {
  state: EmployeeControlState;
  transition?:
    | "disabled"
    | "re_enabled"
    | "restricted"
    | "restrictions_cleared";
  budgetOverride?: EmployeeBudget;
  authorityOverride?: EmployeeAuthority;
};

export type EmployeeControlsListEntry = {
  employeeId: string;
  control: EmployeeControl | null;
  effectiveState: EffectiveState;
};

export type EmployeeControlsListResponse = {
  ok: true;
  count: number;
  entries: EmployeeControlsListEntry[];
};

export type EmployeeControlDetailResponse = {
  ok: true;
  employeeId: string;
  control: EmployeeControl | null;
  effectiveState?: EffectiveState;
};

export type EmployeeControlsResponse =
  | EmployeeControlsListResponse
  | EmployeeControlDetailResponse;

export type SchedulerStatusResponse = {
  primaryScheduler: "paperclip";
  cronFallbackEnabled: boolean;
};