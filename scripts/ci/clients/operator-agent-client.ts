/* eslint-disable no-console */

import type { InboundExternalMessage } from "../../../core/operator-agent/src/adapters/inbound-types";
import type { ExternalActionEnvelope } from "../../../core/operator-agent/src/adapters/inbound-action-types";
import { getJson, postJson } from "../shared/http";
import { resolveServiceBaseUrl } from "../shared/service-map";
import type {
  EmployeeControlDetailResponse,
  EmployeeControlsListResponse,
  EmployeeEffectivePolicyResponse,
  EmployeesListResponse,
  EmployeeScopeResponse,
  SchedulerStatusResponse,
} from "../contracts/employees";
import type {
  ApprovalDetailResponse,
  ApprovalsListResponse,
} from "../contracts/approvals";
import type {
  ControlHistoryListResponse,
  EscalationsListResponse,
} from "../contracts/escalations";
import type {
  ManagerLogResponse,
} from "../contracts/manager";
import type {
  WorkLogResponse,
} from "../contracts/work-log";

export type RunEmployeeRequest = {
  companyId?: string;
  teamId?: string;
  departmentId?: string;
  taskId?: string;
  workOrderId?: string;
  employeeId: string;
  roleId: string;
  trigger: string;
  policyVersion?: string;
  targetEmployeeIdOverride?: string;
};

export type CreateTaskRequest = {
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
};

export type DelegateTaskFromThreadRequest = {
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

export type CreateTaskArtifactRequest = {
  companyId?: string;
  createdByEmployeeId?: string;
  artifactType: "plan" | "result" | "evidence";
  summary?: string;
  content?: Record<string, unknown>;
};

export type CreateMessageThreadRequest = {
  companyId?: string;
  topic: string;
  createdByEmployeeId?: string;
  relatedTaskId?: string;
  relatedArtifactId?: string;
  relatedApprovalId?: string;
  relatedEscalationId?: string;
  visibility?: "internal" | "org";
  externalInteractionPolicy?: {
    inboundRepliesAllowed?: boolean;
    externalActionsAllowed?: boolean;
    allowedChannels?: Array<"slack" | "email">;
    allowedTargets?: string[];
    allowedExternalActors?: string[];
  };
};

export type CreateMessageRequest = {
  companyId?: string;
  threadId?: string;
  topic?: string;
  senderEmployeeId: string;
  receiverEmployeeId?: string;
  receiverTeamId?: string;
  type: "task" | "escalation" | "coordination";
  source?: "internal" | "dashboard" | "system" | "human" | "slack" | "email";
  subject?: string;
  body: string;
  payload?: Record<string, unknown>;
  externalMessageId?: string;
  externalChannel?: "slack" | "email";
  externalAuthorId?: string;
  externalReceivedAt?: string;
  requiresResponse?: boolean;
  responseActionType?: string;
  responseActionStatus?: "requested" | "applied" | "rejected";
  causedStateTransition?: boolean;
  relatedTaskId?: string;
  relatedArtifactId?: string;
  relatedEscalationId?: string;
  relatedApprovalId?: string;
};

export type CreateOperatorAgentClientOptions = {
  baseUrl?: string;
};

export function createOperatorAgentClient(
  options: CreateOperatorAgentClientOptions = {},
) {
  const baseUrl =
    options.baseUrl ??
    resolveServiceBaseUrl({
      envVar: "OPERATOR_AGENT_BASE_URL",
      serviceName: "operator-agent",
    });

  function buildUrl(path: string, search?: URLSearchParams): string {
    const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
    const query =
      search && search.toString().length > 0 ? `?${search.toString()}` : "";
    return `${normalizedBaseUrl}${path}${query}`;
  }

  return {
    baseUrl,

    async listEmployees(params?: {
      status?: string;
      teamId?: string;
    }): Promise<EmployeesListResponse> {
      const search = new URLSearchParams();

      if (params?.status) {
        search.set("status", params.status);
      }

      if (params?.teamId) {
        search.set("teamId", params.teamId);
      }

      return getJson<EmployeesListResponse>(
        buildUrl("/agent/employees", search),
      );
    },

    async getEmployeeScope(employeeId: string): Promise<EmployeeScopeResponse> {
      return getJson<EmployeeScopeResponse>(
        buildUrl(`/agent/employees/${encodeURIComponent(employeeId)}/scope`),
      );
    },

    async getEmployeeEffectivePolicy(
      employeeId: string,
    ): Promise<EmployeeEffectivePolicyResponse> {
      return getJson<EmployeeEffectivePolicyResponse>(
        buildUrl(
          `/agent/employees/${encodeURIComponent(employeeId)}/effective-policy`,
        ),
      );
    },

    async listEmployeeControls(): Promise<EmployeeControlsListResponse> {
      return getJson<EmployeeControlsListResponse>(
        buildUrl("/agent/employee-controls"),
      );
    },

    async getEmployeeControls(
      employeeId: string,
    ): Promise<EmployeeControlDetailResponse> {
      const search = new URLSearchParams({
        employeeId,
      });

      return getJson<EmployeeControlDetailResponse>(
        buildUrl("/agent/employee-controls", search),
      );
    },

    async listApprovals(params?: {
      limit?: number;
    }): Promise<ApprovalsListResponse> {
      const search = new URLSearchParams();

      if (typeof params?.limit === "number") {
        search.set("limit", String(params.limit));
      }

      return getJson<ApprovalsListResponse>(
        buildUrl("/agent/approvals", search),
      );
    },

    async getApproval(id: string): Promise<ApprovalDetailResponse> {
      return getJson<ApprovalDetailResponse>(
        buildUrl(`/agent/approvals/${encodeURIComponent(id)}`),
      );
    },

    async approveApproval(body: {
      approvalId: string;
      decidedBy?: string;
      decisionNote?: string;
    }): Promise<any> {
      return postJson(buildUrl("/agent/approvals/approve"), body);
    },

    async rejectApproval(body: {
      approvalId: string;
      decidedBy?: string;
      decisionNote?: string;
    }): Promise<any> {
      return postJson(buildUrl("/agent/approvals/reject"), body);
    },

    async seedApproval(body: {
      requestedByEmployeeId: string;
      requestedByRoleId: string;
      actionType: string;
      reason: string;
      message: string;
      requestedByEmployeeName?: string;
      companyId?: string;
      taskId?: string;
      createThread?: boolean;
      threadTopic?: string;
      threadReceiverEmployeeId?: string;
    }): Promise<any> {
      return postJson(buildUrl("/agent/te/seed-approval"), body);
    },

    async approveFromThread(threadId: string, body?: {
      actor?: string;
      note?: string;
    }): Promise<any> {
      return postJson(
        buildUrl(`/agent/message-threads/${encodeURIComponent(threadId)}/approve`),
        body ?? {},
      );
    },

    async rejectFromThread(threadId: string, body?: {
      actor?: string;
      note?: string;
    }): Promise<any> {
      return postJson(
        buildUrl(`/agent/message-threads/${encodeURIComponent(threadId)}/reject`),
        body ?? {},
      );
    },

    async acknowledgeEscalation(body: {
      escalationId: string;
      actor?: string;
    }): Promise<any> {
      const search = new URLSearchParams({
        id: body.escalationId,
      });

      return postJson(
        buildUrl("/agent/escalations/acknowledge", search),
        {},
        {
          headers: body.actor
            ? {
                "x-actor": body.actor,
              }
            : undefined,
        },
      );
    },

    async resolveEscalation(body: {
      escalationId: string;
      actor?: string;
      note?: string;
    }): Promise<any> {
      return postJson(
        buildUrl("/agent/escalations/resolve"),
        {
          id: body.escalationId,
          note: body.note,
        },
        {
          headers: body.actor
            ? {
                "x-actor": body.actor,
              }
            : undefined,
        },
      );
    },

    async acknowledgeEscalationFromThread(threadId: string, body?: {
      actor?: string;
    }): Promise<any> {
      return postJson(
        buildUrl(`/agent/message-threads/${encodeURIComponent(threadId)}/acknowledge-escalation`),
        body ?? {},
      );
    },

    async resolveEscalationFromThread(threadId: string, body?: {
      actor?: string;
      note?: string;
    }): Promise<any> {
      return postJson(
        buildUrl(`/agent/message-threads/${encodeURIComponent(threadId)}/resolve-escalation`),
        body ?? {},
      );
    },

    async listEscalations(params?: {
      limit?: number;
    }): Promise<EscalationsListResponse> {
      const search = new URLSearchParams();

      if (typeof params?.limit === "number") {
        search.set("limit", String(params.limit));
      }

      return getJson<EscalationsListResponse>(
        buildUrl("/agent/escalations", search),
      );
    },

    async getEscalation(escalationId: string): Promise<any> {
      return getJson(buildUrl(`/agent/escalations/${encodeURIComponent(escalationId)}`));
    },

    async listControlHistory(params?: {
      limit?: number;
    }): Promise<ControlHistoryListResponse> {
      const search = new URLSearchParams();

      if (typeof params?.limit === "number") {
        search.set("limit", String(params.limit));
      }

      return getJson<ControlHistoryListResponse>(
        buildUrl("/agent/control-history", search),
      );
    },

    async getSchedulerStatus(): Promise<SchedulerStatusResponse> {
      return getJson<SchedulerStatusResponse>(
        buildUrl("/agent/scheduler-status"),
      );
    },

    async getManagerLog(params: {
      managerEmployeeId: string;
      limit?: number;
    }): Promise<ManagerLogResponse> {
      const search = new URLSearchParams({
        managerEmployeeId: params.managerEmployeeId,
      });

      if (typeof params.limit === "number") {
        search.set("limit", String(params.limit));
      }

      return getJson<ManagerLogResponse>(
        buildUrl("/agent/manager-log", search),
      );
    },

    async getWorkLog(params: {
      employeeId: string;
      limit?: number;
    }): Promise<WorkLogResponse> {
      const search = new URLSearchParams({
        employeeId: params.employeeId,
      });

      if (typeof params.limit === "number") {
        search.set("limit", String(params.limit));
      }

      return getJson<WorkLogResponse>(
        buildUrl("/agent/work-log", search),
      );
    },

    async createTask(body: CreateTaskRequest): Promise<any> {
      return postJson(buildUrl("/agent/tasks"), body);
    },

    async listTasks(params?: {
      companyId?: string;
      assignedTeamId?: string;
      assignedEmployeeId?: string;
      status?: string;
      limit?: number;
    }): Promise<any> {
      const search = new URLSearchParams();

      if (params?.companyId) {
        search.set("companyId", params.companyId);
      }

      if (params?.assignedTeamId) {
        search.set("assignedTeamId", params.assignedTeamId);
      }

      if (params?.assignedEmployeeId) {
        search.set("assignedEmployeeId", params.assignedEmployeeId);
      }

      if (params?.status) {
        search.set("status", params.status);
      }

      if (typeof params?.limit === "number") {
        search.set("limit", String(params.limit));
      }

      return getJson(buildUrl("/agent/tasks", search));
    },

    async getTask(taskId: string): Promise<any> {
      return getJson(
        buildUrl(`/agent/tasks/${encodeURIComponent(taskId)}`),
      );
    },

    async createTaskArtifact(
      taskId: string,
      body: CreateTaskArtifactRequest,
    ): Promise<any> {
      return postJson(
        buildUrl(`/agent/tasks/${encodeURIComponent(taskId)}/artifacts`),
        body,
      );
    },

    async listTaskArtifacts(
      taskId: string,
      params?: {
        artifactType?: string;
        limit?: number;
      },
    ): Promise<any> {
      const search = new URLSearchParams();

      if (params?.artifactType) {
        search.set("artifactType", params.artifactType);
      }

      if (typeof params?.limit === "number") {
        search.set("limit", String(params.limit));
      }

      return getJson(
        buildUrl(`/agent/tasks/${encodeURIComponent(taskId)}/artifacts`, search),
      );
    },

    async createMessageThread(body: CreateMessageThreadRequest): Promise<any> {
      return postJson(buildUrl("/agent/message-threads"), body);
    },

    async listMessageThreads(params?: {
      companyId?: string;
      createdByEmployeeId?: string;
      relatedTaskId?: string;
      relatedArtifactId?: string;
      participantEmployeeId?: string;
      limit?: number;
    }): Promise<any> {
      const search = new URLSearchParams();

      if (params?.companyId) search.set("companyId", params.companyId);
      if (params?.createdByEmployeeId) search.set("createdByEmployeeId", params.createdByEmployeeId);
      if (params?.relatedTaskId) search.set("relatedTaskId", params.relatedTaskId);
      if (params?.relatedArtifactId) search.set("relatedArtifactId", params.relatedArtifactId);
      if (params?.participantEmployeeId) search.set("participantEmployeeId", params.participantEmployeeId);
      if (typeof params?.limit === "number") search.set("limit", String(params.limit));

      return getJson(buildUrl("/agent/message-threads", search));
    },

    async getMessageThread(threadId: string): Promise<any> {
      return getJson(buildUrl(`/agent/message-threads/${encodeURIComponent(threadId)}`));
    },

    async delegateTaskFromThread(
      threadId: string,
      body: DelegateTaskFromThreadRequest,
    ): Promise<any> {
      return postJson(
        buildUrl(`/agent/message-threads/${encodeURIComponent(threadId)}/delegate-task`),
        body,
      );
    },

    async createMessage(body: CreateMessageRequest): Promise<any> {
      return postJson(buildUrl("/agent/messages"), body);
    },

    async ingestExternalMessage(input: InboundExternalMessage): Promise<any> {
      return postJson(buildUrl("/agent/messages/inbound"), input);
    },

    async sendExternalAction(input: ExternalActionEnvelope): Promise<any> {
      return postJson(buildUrl("/agent/messages/external-action"), input);
    },

    async listMessages(params?: {
      threadId?: string;
      senderEmployeeId?: string;
      receiverEmployeeId?: string;
      receiverTeamId?: string;
      relatedTaskId?: string;
      relatedArtifactId?: string;
      limit?: number;
    }): Promise<any> {
      const search = new URLSearchParams();

      if (params?.threadId) search.set("threadId", params.threadId);
      if (params?.senderEmployeeId) search.set("senderEmployeeId", params.senderEmployeeId);
      if (params?.receiverEmployeeId) search.set("receiverEmployeeId", params.receiverEmployeeId);
      if (params?.receiverTeamId) search.set("receiverTeamId", params.receiverTeamId);
      if (params?.relatedTaskId) search.set("relatedTaskId", params.relatedTaskId);
      if (params?.relatedArtifactId) search.set("relatedArtifactId", params.relatedArtifactId);
      if (typeof params?.limit === "number") search.set("limit", String(params.limit));

      return getJson(buildUrl("/agent/messages", search));
    },

    async getInbox(employeeId: string, params?: { limit?: number }): Promise<any> {
      const search = new URLSearchParams();
      if (typeof params?.limit === "number") search.set("limit", String(params.limit));
      return getJson(buildUrl(`/agent/inbox/${encodeURIComponent(employeeId)}`, search));
    },

    async getOutbox(employeeId: string, params?: { limit?: number }): Promise<any> {
      const search = new URLSearchParams();
      if (typeof params?.limit === "number") search.set("limit", String(params.limit));
      return getJson(buildUrl(`/agent/outbox/${encodeURIComponent(employeeId)}`, search));
    },

    async endpointExists(path: string): Promise<boolean> {
      const response = await fetch(buildUrl(path), {
        method: "OPTIONS",
      });

      return response.ok || response.status === 405;
    },

    async runEmployee<T = Record<string, unknown>>(
      request: RunEmployeeRequest,
      init?: {
        executionSource?: string;
        actor?: string;
      },
    ): Promise<T> {
      return postJson<T>(
        buildUrl("/agent/run"),
        request,
        {
          headers: {
            "x-aep-execution-source": init?.executionSource ?? "operator",
            "x-actor": init?.actor ?? "ci-operator-agent-client",
          },
        },
      );
    },
  };
}