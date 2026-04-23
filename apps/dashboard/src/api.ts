import type {
  CreateCanonicalThreadMessageInput,
  CreateCanonicalThreadMessageResponse,
  DelegateTaskFromThreadInput,
  DelegateTaskFromThreadResponse,
  EmployeeEmploymentEvent,
  EmployeeContinuityOverview,
  EmployeeControlOverview,
  EmployeeEffectivePolicyOverview,
  EmployeePerformanceRecommendation,
  EmployeePerformanceReviewEvidence,
  EmployeePerformanceReviewRecord,
  EmployeePublicLink,
  EmployeeReviewCycleRecord,
  ExternalMirrorOverview,
  MessageThreadDetail,
  MessageThreadRecord,
  MirrorThreadOverview,
  NarrativeTimeline,
  NarrativeTimelineItem,
  OrgPresenceOverview,
  RoleJobDescriptionProjection,
  RuntimeRolePolicyInput,
  RuntimeRolePolicyRecord,
  TaskDetail,
  TaskRecord,
  ApprovalRecord,
  ControlHistoryRecord,
  DepartmentOverview,
  EscalationMutationResponse,
  EscalationRecord,
  ManagerDecisionRecord,
  EmployeeEmploymentStatus,
  OperatorEmployeeRecord,
  SchedulerStatus,
  ServiceOverview,
  TeamRoadmap,
  TenantOverview,
  TenantSummary,
  ValidationOverview,
  ValidationSchedulerState,
  ValidationRunMode,
} from "./types";

// Normalizer for employee records to ensure shape stability
function normalizeEmployeeRecord(
  employee: OperatorEmployeeRecord,
): OperatorEmployeeRecord {
  return {
    ...employee,
    employment: {
      employmentStatus: employee.employment?.employmentStatus ?? "active",
      schedulerMode: employee.employment?.schedulerMode ?? "auto",
      isSynthetic: employee.employment?.isSynthetic === true,
    },
    runtime: {
      ...employee.runtime,
      effectiveState: employee.runtime?.effectiveState,
      effectiveBudget: employee.runtime?.effectiveBudget,
      effectiveAuthority: employee.runtime?.effectiveAuthority,
    },
    publicProfile: employee.publicProfile,
    publicLinks: Array.isArray(employee.publicLinks) ? employee.publicLinks : [],
    visualIdentity: employee.visualIdentity,
    hasCognitiveProfile: employee.hasCognitiveProfile === true,
  };
}

function normalizeRole(role: RoleJobDescriptionProjection): RoleJobDescriptionProjection {
  return {
    ...role,
    responsibilities: Array.isArray(role.responsibilities) ? role.responsibilities : [],
    successMetrics: Array.isArray(role.successMetrics) ? role.successMetrics : [],
    constraints: Array.isArray(role.constraints) ? role.constraints : [],
    reviewDimensions: Array.isArray(role.reviewDimensions) ? role.reviewDimensions : [],
  };
}

const LOCAL_CONTROL_PLANE_BASE_URL = "http://127.0.0.1:8788";
const LOCAL_OPERATOR_AGENT_BASE_URL = "http://127.0.0.1:8797";

function isLocalDevBuild(): boolean {
  return import.meta.env.DEV === true;
}

function requireConfiguredBaseUrl(args: {
  value: string | undefined;
  envVarName: string;
  localFallback: string;
}): string {
  const configured = args.value?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (isLocalDevBuild()) {
    return args.localFallback;
  }

  throw new Error(
    `Missing required dashboard config ${args.envVarName}; refusing to fall back to localhost outside local dev`,
  );
}

type RuntimeStatus = "implemented" | "planned" | "disabled" | "active";

type LiveEmployeeResolutionRequest = {
  key: string;
  roleId: string;
  teamId?: string;
  runtimeStatus?: RuntimeStatus;
};

type LiveEmployeeResolutionMap = Record<string, string>;

export function getApiBaseUrl(): string {
  return requireConfiguredBaseUrl({
    value: import.meta.env.VITE_CONTROL_PLANE_BASE_URL,
    envVarName: "VITE_CONTROL_PLANE_BASE_URL",
    localFallback: LOCAL_CONTROL_PLANE_BASE_URL,
  });
}

export function getOperatorAgentBaseUrl(): string {
  return requireConfiguredBaseUrl({
    value: import.meta.env.VITE_OPERATOR_AGENT_BASE_URL,
    envVarName: "VITE_OPERATOR_AGENT_BASE_URL",
    localFallback: LOCAL_OPERATOR_AGENT_BASE_URL,
  });
}

async function getJson<T>(baseUrl: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

async function postJson<T>(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Request failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ""}`,
    );
  }

  return (await response.json()) as T;
}

async function patchJson<T>(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Request failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ""}`,
    );
  }

  return (await response.json()) as T;
}

function matchesResolvedEmployee(
  employee: OperatorEmployeeRecord,
  request: LiveEmployeeResolutionRequest,
): boolean {
  if (employee.identity.roleId !== request.roleId) {
    return false;
  }

  if (request.teamId && employee.identity.teamId !== request.teamId) {
    return false;
  }

  if (
    request.runtimeStatus &&
    employee.runtime.runtimeStatus !== request.runtimeStatus
  ) {
    return false;
  }

  if (employee.employment?.employmentStatus !== "active") {
    return false;
  }

  return true;
}

async function resolveLiveEmployeeIdsByRole(
  requests: LiveEmployeeResolutionRequest[],
): Promise<LiveEmployeeResolutionMap> {
  const payload = await getJson<{ employees: OperatorEmployeeRecord[] }>(
    getOperatorAgentBaseUrl(),
    "/agent/employees",
  );

  const employees = (payload.employees ?? []).map(normalizeEmployeeRecord);
  const resolved: LiveEmployeeResolutionMap = {};

  for (const request of requests) {
    const match = employees.find((employee) =>
      matchesResolvedEmployee(employee, request),
    );

    if (!match) {
      throw new Error(
        `Unable to resolve live employee for roleId=${request.roleId}${request.teamId ? ` teamId=${request.teamId}` : ""}`,
      );
    }

    resolved[request.key] = match.identity.employeeId;
  }

  return resolved;
}

export type CreateEmployeeRequest = {
  employeeId?: string;
  companyId?: string;
  teamId: string;
  roleId: string;
  employeeName: string;
  runtimeStatus?: "planned" | "active" | "disabled";
  employmentStatus?: EmployeeEmploymentStatus;
  schedulerMode?: string;
  bio?: string;
  tone?: string;
  skills?: string[];
  avatarUrl?: string;
  appearanceSummary?: string;
  birthYear?: number;
  publicLinks?: EmployeePublicLink[];
  approvedBy?: string;
  threadId?: string;
  effectiveAt?: string;
  reason?: string;
};

export type UpdateEmployeeProfileRequest = {
  employeeName?: string;
  schedulerMode?: string;
  bio?: string;
  tone?: string;
  skills?: string[];
  avatarUrl?: string;
  appearanceSummary?: string;
  birthYear?: number;
  publicLinks?: EmployeePublicLink[];
};

export type EmployeeLifecycleAction =
  | "activate"
  | "reassign-team"
  | "change-role"
  | "start-leave"
  | "end-leave"
  | "retire"
  | "terminate"
  | "rehire"
  | "archive";

export type RunEmployeeLifecycleActionRequest = {
  toTeamId?: string;
  toRoleId?: string;
  reason?: string;
  approvedBy?: string;
  threadId?: string;
  effectiveAt?: string;
};

export type CreateReviewCycleRequest = {
  companyId?: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  status?: "draft" | "active" | "closed";
  createdBy?: string;
};

export type CreateEmployeeReviewRequest = {
  reviewCycleId: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  dimensionScores: Array<{ key: string; score: number; note?: string }>;
  recommendations: EmployeePerformanceRecommendation[];
  evidence: EmployeePerformanceReviewEvidence[];
  createdBy?: string;
  approvedBy?: string;
};

export async function getTenants(): Promise<TenantSummary[]> {
  const payload = await getJson<{ tenants: TenantSummary[] }>(
    getApiBaseUrl(),
    "/tenants",
  );
  return payload.tenants;
}

export async function getTenantOverview(
  tenantId: string,
): Promise<TenantOverview> {
  return getJson<TenantOverview>(
    getApiBaseUrl(),
    `/tenants/${encodeURIComponent(tenantId)}`,
  );
}

export async function getValidationOverview(): Promise<ValidationOverview> {
  return getJson<ValidationOverview>(getApiBaseUrl(), "/validation/overview");
}

export async function getValidationScheduler(): Promise<ValidationSchedulerState> {
  const payload = await getJson<{ scheduler: ValidationSchedulerState }>(
    getApiBaseUrl(),
    "/validation/scheduler",
  );
  return payload.scheduler;
}

export async function runValidationNow(args: {
  requestedBy: string;
  mode: ValidationRunMode;
  reason?: "scheduled_health" | "drift_detection" | "governance_review";
}): Promise<{
  dispatch_batch_id: string;
  dispatched: number;
  executed: number;
  scheduler: ValidationSchedulerState | null;
}> {
  return postJson<{
    dispatch_batch_id: string;
    dispatched: number;
    executed: number;
    scheduler: ValidationSchedulerState | null;
  }>(getApiBaseUrl(), "/validation/run-now", {
    requested_by: args.requestedBy,
    mode: args.mode,
    reason: args.reason ?? "governance_review",
  });
}

export async function pauseValidationScheduler(args: {
  requestedBy: string;
  reason: string;
}): Promise<ValidationSchedulerState> {
  const payload = await postJson<{ scheduler: ValidationSchedulerState }>(
    getApiBaseUrl(),
    "/validation/scheduler/pause",
    {
      requested_by: args.requestedBy,
      reason: args.reason,
    },
  );

  return payload.scheduler;
}

export async function resumeValidationScheduler(
  requestedBy: string,
): Promise<ValidationSchedulerState> {
  const payload = await postJson<{ scheduler: ValidationSchedulerState }>(
    getApiBaseUrl(),
    "/validation/scheduler/resume",
    {
      requested_by: requestedBy,
    },
  );

  return payload.scheduler;
}

export async function getServiceOverview(
  tenantId: string,
  serviceId: string,
): Promise<ServiceOverview> {
  return getJson<ServiceOverview>(
    getApiBaseUrl(),
    `/tenants/${encodeURIComponent(tenantId)}/services/${encodeURIComponent(serviceId)}`,
  );
}

export async function getDepartmentOverview(): Promise<DepartmentOverview> {
  const agentBaseUrl = getOperatorAgentBaseUrl();
  const resolvedEmployees = await resolveLiveEmployeeIdsByRole([
    {
      key: "infraOpsManager",
      roleId: "infra-ops-manager",
      teamId: "team_infra",
      runtimeStatus: "implemented",
    },
    {
      key: "timeoutRecovery",
      roleId: "timeout-recovery-operator",
      teamId: "team_infra",
      runtimeStatus: "implemented",
    },
  ]);

  const managerEmployeeId = resolvedEmployees.infraOpsManager;

  const [
    employeesPayload,
    escalationsPayload,
    controlHistoryPayload,
    managerLogPayload,
    approvalsPayload,
    roadmapsPayload,
    schedulerStatus,
  ] = await Promise.all([
    getJson<{ employees: OperatorEmployeeRecord[] }>(
      agentBaseUrl,
      "/agent/employees",
    ),
    getJson<{ entries: EscalationRecord[] }>(
      agentBaseUrl,
      "/agent/escalations?limit=50",
    ),
    getJson<{ entries: ControlHistoryRecord[] }>(
      agentBaseUrl,
      "/agent/control-history?limit=50",
    ),
    getJson<{ entries: ManagerDecisionRecord[] }>(
      agentBaseUrl,
      `/agent/manager-log?managerEmployeeId=${encodeURIComponent(managerEmployeeId)}&limit=50`,
    ),
    getJson<{ entries: ApprovalRecord[] }>(
      agentBaseUrl,
      "/agent/approvals?limit=50",
    ),
    getJson<{ entries: TeamRoadmap[] }>(agentBaseUrl, "/agent/roadmaps"),
    getJson<SchedulerStatus>(agentBaseUrl, "/agent/scheduler-status"),
  ]);

  return {
    employees: (employeesPayload.employees ?? []).map(normalizeEmployeeRecord),
    escalations: escalationsPayload.entries ?? [],
    controlHistory: controlHistoryPayload.entries ?? [],
    managerLog: managerLogPayload.entries ?? [],
    approvals: approvalsPayload.entries ?? [],
    roadmaps: roadmapsPayload.entries ?? [],
    schedulerStatus,
  };
}

export async function getWorkTasks(): Promise<TaskRecord[]> {
  const payload = await getJson<{ ok: boolean; tasks: TaskRecord[] }>(
    getOperatorAgentBaseUrl(),
    "/agent/tasks?limit=100",
  );
  return payload.tasks ?? [];
}

export async function getTaskDetail(taskId: string): Promise<TaskDetail> {
  return getJson<TaskDetail>(
    getOperatorAgentBaseUrl(),
    `/agent/tasks/${encodeURIComponent(taskId)}`,
  );
}

export async function getMessageThreads(): Promise<MessageThreadRecord[]> {
  const payload = await getJson<{ ok: boolean; threads: MessageThreadRecord[] }>(
    getOperatorAgentBaseUrl(),
    "/agent/message-threads?limit=100",
  );
  return payload.threads ?? [];
}

export async function getMessageThreadDetail(
  threadId: string,
): Promise<MessageThreadDetail> {
  return getJson<MessageThreadDetail>(
    getOperatorAgentBaseUrl(),
    `/agent/message-threads/${encodeURIComponent(threadId)}`,
  );
}

export async function getOrgPresenceOverview(): Promise<OrgPresenceOverview> {
  const [departmentOverview, tasks, threads] = await Promise.all([
    getDepartmentOverview(),
    getWorkTasks(),
    getMessageThreads(),
  ]);

  return {
    employees: departmentOverview.employees,
    tasks,
    threads,
    roadmaps: departmentOverview.roadmaps,
    schedulerStatus: departmentOverview.schedulerStatus,
  };
}

export async function getEmployeeControlOverview(
  employeeId: string,
): Promise<EmployeeControlOverview> {
  return getJson<EmployeeControlOverview>(
    getOperatorAgentBaseUrl(),
    `/agent/employee-controls?employeeId=${encodeURIComponent(employeeId)}`,
  );
}

export async function getEmployeeEffectivePolicy(
  employeeId: string,
): Promise<EmployeeEffectivePolicyOverview> {
  return getJson<EmployeeEffectivePolicyOverview>(
    getOperatorAgentBaseUrl(),
    `/agent/employees/${encodeURIComponent(employeeId)}/effective-policy`,
  );
}

export async function getEmployeeContinuityOverview(
  employeeId: string,
): Promise<EmployeeContinuityOverview> {
  const [orgOverview, departmentOverview] = await Promise.all([
    getOrgPresenceOverview(),
    getDepartmentOverview(),
  ]);

  const touchesTask = (task: TaskRecord): boolean =>
    task.assignedEmployeeId === employeeId ||
    task.ownerEmployeeId === employeeId ||
    task.createdByEmployeeId === employeeId;

  const activeStatuses = new Set(["queued", "ready", "in_progress", "blocked", "escalated"]);

  const activeTasks = orgOverview.tasks
    .filter((task) => touchesTask(task) && activeStatuses.has(task.status))
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, 6);

  const recentTasks = orgOverview.tasks
    .filter(touchesTask)
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, 8);

  const activeThreads = orgOverview.threads
    .filter((thread) => thread.createdByEmployeeId === employeeId)
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, 8);

  const recentManagerDecisions = departmentOverview.managerLog
    .filter((entry) => entry.employeeId === employeeId)
    .sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""))
    .slice(0, 6);

  const recentControlHistory = departmentOverview.controlHistory
    .filter((entry) => entry.employeeId === employeeId)
    .sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""))
    .slice(0, 6);

  return {
    employeeId,
    activeTasks,
    recentTasks,
    activeThreads,
    recentManagerDecisions,
    recentControlHistory,
  };
}

export async function getDefaultRuntimeEmployeeIds(): Promise<{
  infraOpsManagerEmployeeId: string;
  timeoutRecoveryEmployeeId: string;
}> {
  const resolvedEmployees = await resolveLiveEmployeeIdsByRole([
    {
      key: "infraOpsManager",
      roleId: "infra-ops-manager",
      teamId: "team_infra",
      runtimeStatus: "implemented",
    },
    {
      key: "timeoutRecovery",
      roleId: "timeout-recovery-operator",
      teamId: "team_infra",
      runtimeStatus: "implemented",
    },
  ]);

  return {
    infraOpsManagerEmployeeId: resolvedEmployees.infraOpsManager,
    timeoutRecoveryEmployeeId: resolvedEmployees.timeoutRecovery,
  };
}

export async function getRoles(teamId?: string): Promise<RoleJobDescriptionProjection[]> {
  const path = teamId
    ? `/agent/roles?teamId=${encodeURIComponent(teamId)}`
    : "/agent/roles";
  const payload = await getJson<{
    ok: boolean;
    count: number;
    roles: RoleJobDescriptionProjection[];
  }>(getOperatorAgentBaseUrl(), path);
  return (payload.roles ?? []).map(normalizeRole);
}

export async function getRuntimeRolePolicies(): Promise<RuntimeRolePolicyRecord[]> {
  const payload = await getJson<{
    ok: boolean;
    count: number;
    policies: RuntimeRolePolicyRecord[];
  }>(getOperatorAgentBaseUrl(), "/agent/runtime-role-policies");

  return payload.policies ?? [];
}

export async function getRuntimeRolePolicy(
  roleId: string,
): Promise<RuntimeRolePolicyRecord> {
  const payload = await getJson<{
    ok: boolean;
    policy: RuntimeRolePolicyRecord;
  }>(
    getOperatorAgentBaseUrl(),
    `/agent/runtime-role-policies/${encodeURIComponent(roleId)}`,
  );

  return payload.policy;
}

export async function updateRuntimeRolePolicy(
  roleId: string,
  input: RuntimeRolePolicyInput,
): Promise<RuntimeRolePolicyRecord> {
  const payload = await patchJson<{
    ok: boolean;
    policy: RuntimeRolePolicyRecord;
  }>(
    getOperatorAgentBaseUrl(),
    `/agent/runtime-role-policies/${encodeURIComponent(roleId)}`,
    input as unknown as Record<string, unknown>,
  );

  return payload.policy;
}

export async function getReviewCycles(): Promise<EmployeeReviewCycleRecord[]> {
  const payload = await getJson<{
    ok: boolean;
    count: number;
    reviewCycles: EmployeeReviewCycleRecord[];
  }>(getOperatorAgentBaseUrl(), "/agent/review-cycles");
  return payload.reviewCycles ?? [];
}

export async function getEmployeeEmploymentEvents(
  employeeId: string,
): Promise<EmployeeEmploymentEvent[]> {
  const payload = await getJson<{
    ok: boolean;
    employeeId: string;
    count: number;
    events: EmployeeEmploymentEvent[];
  }>(
    getOperatorAgentBaseUrl(),
    `/agent/employees/${encodeURIComponent(employeeId)}/employment-events`,
  );
  return payload.events ?? [];
}

export async function getEmployeeReviews(
  employeeId: string,
): Promise<EmployeePerformanceReviewRecord[]> {
  const payload = await getJson<{
    ok: boolean;
    employeeId: string;
    count: number;
    reviews: EmployeePerformanceReviewRecord[];
  }>(
    getOperatorAgentBaseUrl(),
    `/agent/employees/${encodeURIComponent(employeeId)}/reviews`,
  );
  return payload.reviews ?? [];
}

export async function createEmployee(
  request: CreateEmployeeRequest,
): Promise<{ ok: boolean; employeeId: string; employmentStatus: EmployeeEmploymentStatus }> {
  return postJson<{
    ok: boolean;
    employeeId: string;
    employmentStatus: EmployeeEmploymentStatus;
  }>(getOperatorAgentBaseUrl(), "/agent/employees", request);
}

export async function updateEmployeeProfile(
  employeeId: string,
  request: UpdateEmployeeProfileRequest,
): Promise<{ ok: boolean; employeeId: string }> {
  return patchJson<{ ok: boolean; employeeId: string }>(
    getOperatorAgentBaseUrl(),
    `/agent/employees/${encodeURIComponent(employeeId)}`,
    request,
  );
}

export async function runEmployeeLifecycleAction(
  employeeId: string,
  action: EmployeeLifecycleAction,
  request: RunEmployeeLifecycleActionRequest,
): Promise<{
  ok: boolean;
  employeeId: string;
  employmentStatus: EmployeeEmploymentStatus;
  teamId: string;
  roleId: string;
  action: string;
}> {
  return postJson<{
    ok: boolean;
    employeeId: string;
    employmentStatus: EmployeeEmploymentStatus;
    teamId: string;
    roleId: string;
    action: string;
  }>(
    getOperatorAgentBaseUrl(),
    `/agent/employees/${encodeURIComponent(employeeId)}/${action}`,
    request,
  );
}

export async function createReviewCycle(
  request: CreateReviewCycleRequest,
): Promise<EmployeeReviewCycleRecord> {
  const payload = await postJson<{
    ok: boolean;
    reviewCycle: EmployeeReviewCycleRecord;
  }>(getOperatorAgentBaseUrl(), "/agent/review-cycles", request);
  return payload.reviewCycle;
}

export async function createEmployeeReview(
  employeeId: string,
  request: CreateEmployeeReviewRequest,
): Promise<EmployeePerformanceReviewRecord> {
  const payload = await postJson<{
    ok: boolean;
    employeeId: string;
    review: EmployeePerformanceReviewRecord;
  }>(
    getOperatorAgentBaseUrl(),
    `/agent/employees/${encodeURIComponent(employeeId)}/reviews`,
    request,
  );
  return payload.review;
}

export async function getExternalMirrorOverview(): Promise<ExternalMirrorOverview> {
  const threads = await getMessageThreads();

  const details = await Promise.all(
    threads.map(async (thread) => {
      try {
        return await getMessageThreadDetail(thread.id);
      } catch {
        return null;
      }
    }),
  );

  const mirrorThreads: MirrorThreadOverview[] = details
    .filter((detail): detail is MessageThreadDetail => detail !== null)
    .filter((detail) => {
      return (
        detail.externalThreadProjections.length > 0 ||
        detail.externalInteractionAudit.length > 0 ||
        detail.externalInteractionPolicy !== null
      );
    })
    .map((detail) => ({
      thread: detail.thread,
      visibilitySummary: detail.visibilitySummary,
      externalThreadProjections: detail.externalThreadProjections,
      externalInteractionPolicy: detail.externalInteractionPolicy,
      externalInteractionAudit: detail.externalInteractionAudit,
    }));

  mirrorThreads.sort((a, b) =>
    (b.thread.updatedAt ?? "").localeCompare(a.thread.updatedAt ?? ""),
  );

  return {
    threads: mirrorThreads,
  };
}

export async function getNarrativeTimeline(): Promise<NarrativeTimeline> {
  const [tasks, threads] = await Promise.all([
    getWorkTasks(),
    getMessageThreads(),
  ]);

  const taskDetails = await Promise.all(
    tasks.map((task) => getTaskDetail(task.id).catch(() => null)),
  );

  const threadDetails = await Promise.all(
    threads.map((thread) => getMessageThreadDetail(thread.id).catch(() => null)),
  );

  const items: NarrativeTimelineItem[] = [];

  for (const detail of taskDetails) {
    if (!detail) continue;

    const bullets: string[] = [];

    if (detail.visibilitySummary.hasPlanArtifact) {
      bullets.push("Plan artifact present");
    }

    if (detail.visibilitySummary.hasPublicRationaleArtifact) {
      bullets.push("Public rationale published");
    }

    if (detail.visibilitySummary.hasValidationResultArtifact) {
      bullets.push(
        `Validation: ${detail.visibilitySummary.latestValidationStatus ?? "recorded"}`,
      );
    }

    if (detail.visibilitySummary.latestDecisionVerdict) {
      bullets.push(`Decision: ${detail.visibilitySummary.latestDecisionVerdict}`);
    }

    if (detail.dependencies.length > 0) {
      bullets.push(`${detail.dependencies.length} dependencies`);
    }

    if (detail.relatedThreads.length > 0) {
      bullets.push(`${detail.relatedThreads.length} related threads`);
    }

    const summary =
      detail.visibilitySummary.hasValidationResultArtifact
        ? `Task progressed through execution and validation with status ${detail.visibilitySummary.latestValidationStatus ?? "recorded"}.`
        : detail.visibilitySummary.hasPlanArtifact
          ? "Task has been planned and is progressing through canonical execution."
          : "Task is active in the canonical work graph.";

    items.push({
      id: `task:${detail.task.id}`,
      kind: "task_story",
      title: detail.task.title,
      subtitle: `${detail.task.taskType} · ${detail.task.assignedTeamId}`,
      at:
        detail.task.updatedAt ??
        detail.task.createdAt ??
        new Date().toISOString(),
      status: detail.task.status,
      employeeId: detail.task.assignedEmployeeId,
      teamId: detail.task.assignedTeamId,
      taskId: detail.task.id,
      threadId: detail.relatedThreads[0]?.id,
      summary,
      bullets,
    });
  }

  for (const detail of threadDetails) {
    if (!detail) continue;

    if (detail.thread.relatedTaskId) {
      continue;
    }

    const latestMessageAt =
      [...detail.messages]
        .map((message) => message.createdAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ??
      detail.thread.updatedAt ??
      detail.thread.createdAt ??
      new Date().toISOString();

    if (detail.thread.relatedApprovalId) {
      items.push({
        id: `approval:${detail.thread.relatedApprovalId}`,
        kind: "approval_story",
        title: `Approval ${detail.thread.relatedApprovalId}`,
        subtitle: detail.thread.topic,
        at: latestMessageAt,
        status:
          detail.visibilitySummary.approvalActionCount > 0 ? "completed" : "waiting",
        threadId: detail.thread.id,
        approvalId: detail.thread.relatedApprovalId,
        summary:
          "Approval work is being handled through a canonical governance thread.",
        bullets: [
          `${detail.visibilitySummary.messageCount} messages`,
          `${detail.visibilitySummary.approvalActionCount} approval actions`,
          `${detail.externalThreadProjections.length} external projections`,
        ],
      });
      continue;
    }

    if (detail.thread.relatedEscalationId) {
      items.push({
        id: `escalation:${detail.thread.relatedEscalationId}`,
        kind: "escalation_story",
        title: `Escalation ${detail.thread.relatedEscalationId}`,
        subtitle: detail.thread.topic,
        at: latestMessageAt,
        status:
          detail.visibilitySummary.escalationActionCount > 0 ? "running" : "open",
        threadId: detail.thread.id,
        escalationId: detail.thread.relatedEscalationId,
        summary:
          "Escalation handling is active through a canonical governance thread.",
        bullets: [
          `${detail.visibilitySummary.messageCount} messages`,
          `${detail.visibilitySummary.escalationActionCount} escalation actions`,
          `${detail.externalThreadProjections.length} external projections`,
        ],
      });
      continue;
    }

    items.push({
      id: `thread:${detail.thread.id}`,
      kind: "thread_story",
      title: detail.thread.topic,
      subtitle: "coordination thread",
      at: latestMessageAt,
      status: "running",
      threadId: detail.thread.id,
      summary: "Coordination is taking place through a canonical thread.",
      bullets: [
        `${detail.visibilitySummary.messageCount} messages`,
        detail.visibilitySummary.hasPublicRationalePublication
          ? "Public rationale published"
          : "No public rationale publication",
        `${detail.externalThreadProjections.length} external projections`,
      ],
    });
  }

  items.sort((a, b) => b.at.localeCompare(a.at));

  return { items };
}

export async function createCanonicalThreadMessage(
  input: CreateCanonicalThreadMessageInput,
): Promise<CreateCanonicalThreadMessageResponse> {
  return postJson<CreateCanonicalThreadMessageResponse>(
    getOperatorAgentBaseUrl(),
    "/agent/messages",
    {
      threadId: input.threadId,
      senderEmployeeId: "human_dashboard_operator",
      source: "human",
      type: "coordination",
      subject: input.subject,
      body: input.body,
      receiverEmployeeId: input.receiverEmployeeId,
      receiverTeamId: input.receiverTeamId,
      relatedTaskId: input.relatedTaskId,
      relatedApprovalId: input.relatedApprovalId,
      relatedEscalationId: input.relatedEscalationId,
      payload: {
        origin: "dashboard_thread_message",
      },
    },
  );
}

export async function approveFromThread(
  threadId: string,
  note?: string,
): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>(
    getOperatorAgentBaseUrl(),
    `/agent/message-threads/${encodeURIComponent(threadId)}/approve`,
    {
      actor: "human_dashboard_operator",
      note,
    },
  );
}

export async function rejectFromThread(
  threadId: string,
  note?: string,
): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>(
    getOperatorAgentBaseUrl(),
    `/agent/message-threads/${encodeURIComponent(threadId)}/reject`,
    {
      actor: "human_dashboard_operator",
      note,
    },
  );
}

export async function acknowledgeEscalationFromThread(
  threadId: string,
): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>(
    getOperatorAgentBaseUrl(),
    `/agent/message-threads/${encodeURIComponent(threadId)}/acknowledge-escalation`,
    {
      actor: "human_dashboard_operator",
    },
  );
}

export async function resolveEscalationFromThread(
  threadId: string,
  note?: string,
): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>(
    getOperatorAgentBaseUrl(),
    `/agent/message-threads/${encodeURIComponent(threadId)}/resolve-escalation`,
    {
      actor: "human_dashboard_operator",
      note,
    },
  );
}

export async function delegateTaskFromThread(
  input: DelegateTaskFromThreadInput,
): Promise<DelegateTaskFromThreadResponse> {
  return postJson<DelegateTaskFromThreadResponse>(
    getOperatorAgentBaseUrl(),
    `/agent/message-threads/${encodeURIComponent(input.threadId)}/delegate-task`,
    {
      companyId: input.companyId,
      originatingTeamId: input.originatingTeamId,
      assignedTeamId: input.assignedTeamId,
      ownerEmployeeId: input.ownerEmployeeId,
      assignedEmployeeId: input.assignedEmployeeId,
      createdByEmployeeId: input.createdByEmployeeId,
      taskType: input.taskType,
      title: input.title,
      payload: input.payload ?? {},
      dependsOnTaskIds: input.dependsOnTaskIds ?? [],
      sourceMessageId: input.sourceMessageId,
    },
  );
}

export async function approveApproval(
  approvalId: string,
  decidedBy = "dashboard-operator",
  decisionNote = "Approved from dashboard operator review.",
): Promise<{ ok: boolean; approval?: ApprovalRecord }> {
  return postJson<{ ok: boolean; approval?: ApprovalRecord }>(
    getOperatorAgentBaseUrl(),
    "/agent/approvals/approve",
    { approvalId, decidedBy, decisionNote },
  );
}

export async function rejectApproval(
  approvalId: string,
  decidedBy = "dashboard-operator",
  decisionNote = "Rejected from dashboard operator review.",
): Promise<{ ok: boolean; approval?: ApprovalRecord }> {
  return postJson<{ ok: boolean; approval?: ApprovalRecord }>(
    getOperatorAgentBaseUrl(),
    "/agent/approvals/reject",
    { approvalId, decidedBy, decisionNote },
  );
}

export async function acknowledgeEscalation(
  escalationId: string,
  actor = "dashboard-operator",
): Promise<EscalationMutationResponse> {
  return postJson<EscalationMutationResponse>(
    getOperatorAgentBaseUrl(),
    "/agent/escalations/acknowledge",
    { id: escalationId },
    { "x-actor": actor },
  );
}

export async function resolveEscalation(
  escalationId: string,
  note: string,
  actor = "dashboard-operator",
): Promise<EscalationMutationResponse> {
  return postJson<EscalationMutationResponse>(
    getOperatorAgentBaseUrl(),
    "/agent/escalations/resolve",
    { id: escalationId, note },
    { "x-actor": actor },
  );
}