import type { JobSummary, RunSummary } from "../types";

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AEP API request failed: ${response.status} ${body}`);
  }

  return (await response.json()) as T;
}

interface RawRunItem {
  run_id: string;
  tenant_id?: string;
  service_name?: string;
  status?: string;
}

interface RawJobItem {
  job_id: string;
  job_type?: string;
  status?: string;
  operator_actions?: {
    can_advance_timeout?: boolean;
  };
}

function normalizeRun(raw: RawRunItem): RunSummary {
  return {
    id: raw.run_id,
    tenant: raw.tenant_id,
    service: raw.service_name,
    status: raw.status,
  };
}

function normalizeJob(raw: RawJobItem, runId: string): JobSummary {
  return {
    id: raw.job_id,
    run_id: runId,
    job_type: raw.job_type,
    status: raw.status,
    failure_kind: null,
    operator_actions: raw.operator_actions,
  };
}

export class ControlPlaneClient {
  constructor(private readonly baseUrl: string) {}

  async listRuns(): Promise<RunSummary[]> {
    const response = await fetch(`${this.baseUrl}/runs`, {
      method: "GET",
    });

    const json = await readJson<unknown>(response);

    if (Array.isArray(json)) {
      return (json as RawRunItem[]).map(normalizeRun);
    }

    if (
      json &&
      typeof json === "object" &&
      "runs" in json &&
      Array.isArray((json as { runs?: unknown }).runs)
    ) {
      return ((json as { runs: RawRunItem[] }).runs).map(normalizeRun);
    }

    throw new Error("Unexpected /runs response shape");
  }

  async getRunJobs(runId: string): Promise<JobSummary[]> {
    const response = await fetch(`${this.baseUrl}/runs/${runId}/jobs`, {
      method: "GET",
    });

    const json = await readJson<unknown>(response);

    if (Array.isArray(json)) {
      return (json as RawJobItem[]).map((j) => normalizeJob(j, runId));
    }

    if (
      json &&
      typeof json === "object" &&
      "jobs" in json &&
      Array.isArray((json as { jobs?: unknown }).jobs)
    ) {
      return ((json as { jobs: RawJobItem[] }).jobs).map((j) =>
        normalizeJob(j, runId)
      );
    }

    throw new Error(`Unexpected /runs/${runId}/jobs response shape`);
  }
}
