/* eslint-disable no-console */

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