import type {
  ControlHistoryRecord,
  DepartmentOverview,
  EscalationRecord,
  ManagerDecisionRecord,
  OperatorEmployeeRecord,
  SchedulerStatus,
  ServiceOverview,
  TenantOverview,
  TenantSummary,
} from "./types";

const DEFAULT_CONTROL_PLANE_BASE_URL = "http://127.0.0.1:8788";
const DEFAULT_OPERATOR_AGENT_BASE_URL = "http://127.0.0.1:8797";

export function getApiBaseUrl(): string {
  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  };
  const configured = meta.env?.VITE_CONTROL_PLANE_BASE_URL;
  return (configured && configured.trim()) || DEFAULT_CONTROL_PLANE_BASE_URL;
}

export function getOperatorAgentBaseUrl(): string {
  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  };
  const configured = meta.env?.VITE_OPERATOR_AGENT_BASE_URL;
  return (configured && configured.trim()) || DEFAULT_OPERATOR_AGENT_BASE_URL;
}

async function getJson<T>(baseUrl: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
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

export async function getTenantOverview(tenantId: string): Promise<TenantOverview> {
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
    getJson<SchedulerStatus>(agentBaseUrl, "/agent/scheduler-status"),
  ]);

  return {
    employees: employeesPayload.employees ?? [],
    escalations: escalationsPayload.entries ?? [],
    controlHistory: controlHistoryPayload.entries ?? [],
    managerLog: managerLogPayload.entries ?? [],
    schedulerStatus,
  };
}
