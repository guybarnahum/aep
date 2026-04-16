import type {
  ExternalInteractionAuditRecord,
  ExternalThreadProjectionRecord,
  MessageThreadDetail,
  MessageThreadRecord,
  TaskDetail,
  TaskRecord,
  ApprovalRecord,
  ControlHistoryRecord,
  DepartmentOverview,
  EscalationMutationResponse,
  EscalationRecord,
  ManagerDecisionRecord,
  OperatorEmployeeRecord,
  SchedulerStatus,
  ServiceOverview,
  TeamRoadmap,
  TenantOverview,
  TenantSummary,
} from "./types";

// Normalizer for employee records to ensure shape stability
function normalizeEmployeeRecord(
  employee: OperatorEmployeeRecord,
): OperatorEmployeeRecord {
  return {
    ...employee,
    runtime: {
      ...employee.runtime,
      effectiveState: employee.runtime?.effectiveState,
      effectiveBudget: employee.runtime?.effectiveBudget,
      effectiveAuthority: employee.runtime?.effectiveAuthority,
    },
    publicProfile: employee.publicProfile,
    hasCognitiveProfile: employee.hasCognitiveProfile === true,
  };
}

const DEFAULT_CONTROL_PLANE_BASE_URL = "http://127.0.0.1:8788";
const DEFAULT_OPERATOR_AGENT_BASE_URL = "http://127.0.0.1:8797";

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_CONTROL_PLANE_BASE_URL;
  return (configured && configured.trim()) || DEFAULT_CONTROL_PLANE_BASE_URL;
}

export function getOperatorAgentBaseUrl(): string {
  const configured = import.meta.env.VITE_OPERATOR_AGENT_BASE_URL;
  return (configured && configured.trim()) || DEFAULT_OPERATOR_AGENT_BASE_URL;
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
      "/agent/manager-log?limit=50",
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

export async function getRelatedThreadsForTask(
  taskId: string,
): Promise<MessageThreadRecord[]> {
  const payload = await getJson<{ ok: boolean; threads: MessageThreadRecord[] }>(
    getOperatorAgentBaseUrl(),
    `/agent/message-threads?relatedTaskId=${encodeURIComponent(taskId)}&limit=50`,
  );
  return payload.threads ?? [];
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