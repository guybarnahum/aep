import type {
  CreateCanonicalThreadMessageInput,
  CreateCanonicalThreadMessageResponse,
  ExternalMirrorOverview,
  MessageThreadDetail,
  MessageThreadRecord,
  MirrorThreadOverview,
  NarrativeTimeline,
  NarrativeTimelineItem,
  OrgPresenceOverview,
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