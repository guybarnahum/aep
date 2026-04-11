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

export type ApprovalState =
  | "pending_review"
  | "approved"
  | "rejected"
  | "expired"
  | "already_executed"
  | "pending";

export type ApprovalControlHistoryEntry = {
  id: string;
  timestamp: string;
  action: string;
};

export type ApprovalEntry = {
  id?: string;
  approvalId?: string;
  employeeId?: string;
  requestedByEmployeeId?: string;
  reason: string;
  state?: ApprovalState;
  status?: "pending" | "approved" | "rejected" | "expired";
  requestedAt?: string;
  timestamp?: string;
  expiresAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  consumedAt?: string;
  decidedAt?: string;
  executedAt?: string;
  executionId?: string;
  metadata?: Record<string, unknown>;
  controlHistory?: ApprovalControlHistoryEntry[];
};

export type ApprovalsListResponse = {
  ok: true;
  count: number;
  approvals?: ApprovalEntry[];
  entries?: ApprovalEntry[];
};

export type ApprovalDetailResponse = {
  ok: true;
  id?: string;
  approval?: {
    id?: string;
    approvalId?: string;
  };
};

export type EscalationsListResponse = {
  ok: true;
  count: number;
  entries: unknown[];
};

export type ControlHistoryListResponse = {
  ok: true;
  count: number;
  entries: unknown[];
};

export type ManagerLogResponse = {
  ok: true;
  managerEmployeeId: string;
  count: number;
  entries: unknown[];
};

export type ManagerRunResponse = {
  ok: true;
  status: "completed";
  policyVersion: string;
  summary: {
    repeatedVerificationFailures: number;
    operatorActionFailures: number;
    budgetExhaustionSignals: number;
    reEnableDecisions: number;
    restrictionDecisions: number;
    clearedRestrictionDecisions: number;
    decisionsEmitted: number;
  };
};

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
    const query = search && search.toString().length > 0 ? `?${search.toString()}` : "";
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

    async getEmployeeControls(
      employeeId?: string,
    ): Promise<EmployeeControlsListResponse | EmployeeControlDetailResponse> {
      const search = new URLSearchParams();

      if (employeeId) {
        search.set("employeeId", employeeId);
      }

      return getJson<EmployeeControlsListResponse | EmployeeControlDetailResponse>(
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

    async runEmployee(
      request: RunEmployeeRequest,
      init?: {
        executionSource?: string;
        actor?: string;
      },
    ): Promise<ManagerRunResponse | Record<string, unknown>> {
      return postJson<ManagerRunResponse | Record<string, unknown>>(
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