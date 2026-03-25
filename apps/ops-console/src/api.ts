import type { RunDetail, RunSummary } from "./types";

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

export async function getRuns(limit = 50): Promise<RunSummary[]> {
  const payload = await getJson<{ runs: RunSummary[] }>(`/runs?limit=${limit}`);
  return payload.runs;
}

export async function getRun(runId: string): Promise<RunDetail> {
  return getJson<RunDetail>(`/runs/${encodeURIComponent(runId)}`);
}
