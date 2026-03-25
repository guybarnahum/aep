import type {
  ServiceOverview,
  TenantOverview,
  TenantSummary,
} from "./types";

const DEFAULT_BASE_URL = "http://127.0.0.1:8787";

export function getApiBaseUrl(): string {
  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  };
  const configured = meta.env?.VITE_CONTROL_PLANE_BASE_URL;
  return (configured && configured.trim()) || DEFAULT_BASE_URL;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function getTenants(): Promise<TenantSummary[]> {
  const payload = await getJson<{ tenants: TenantSummary[] }>("/tenants");
  return payload.tenants;
}

export async function getTenantOverview(tenantId: string): Promise<TenantOverview> {
  return getJson<TenantOverview>(`/tenants/${encodeURIComponent(tenantId)}`);
}

export async function getServiceOverview(
  tenantId: string,
  serviceId: string,
): Promise<ServiceOverview> {
  return getJson<ServiceOverview>(
    `/tenants/${encodeURIComponent(tenantId)}/services/${encodeURIComponent(serviceId)}`,
  );
}
