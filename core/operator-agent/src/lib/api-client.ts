import type { JobSummary, RunSummary, TraceEvent } from "@aep/operator-agent/types";

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
  id?: string;
  tenant?: string;
  service?: string;
}

interface RawJobItem {
  job_id: string;
  job_type?: string;
  status?: string;
  run_id?: string;
  id?: string;
  failure_kind?: string | null;
  operator_actions?: {
    can_advance_timeout?: boolean;
  };
}

function normalizeRun(raw: RawRunItem): RunSummary {
  const id = raw.id ?? raw.run_id;

  if (!id) {
    throw new Error("Run item missing id");
  }

  return {
    id,
    tenant: raw.tenant ?? raw.tenant_id,
    service: raw.service ?? raw.service_name,
    status: raw.status,
  };
}

function normalizeJob(raw: RawJobItem, runId: string): JobSummary {
  const id = raw.id ?? raw.job_id;

  if (!id) {
    throw new Error("Job item missing id");
  }

  return {
    id,
    run_id: raw.run_id ?? runId,
    job_type: raw.job_type,
    status: raw.status,
    failure_kind: raw.failure_kind ?? null,
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

  async getTrace(runId: string): Promise<TraceEvent[]> {
    const response = await fetch(`${this.baseUrl}/trace/${runId}`, {
      method: "GET",
    });

    const json = await readJson<unknown>(response);

    if (Array.isArray(json)) {
      return json as TraceEvent[];
    }

    if (
      json &&
      typeof json === "object" &&
      "events" in json &&
      Array.isArray((json as { events?: unknown }).events)
    ) {
      return (json as { events: TraceEvent[] }).events;
    }

    if (
      json &&
      typeof json === "object" &&
      "trace" in json &&
      Array.isArray((json as { trace?: unknown }).trace)
    ) {
      return (json as { trace: TraceEvent[] }).trace;
    }

    throw new Error(`Unexpected /trace/${runId} response shape`);
  }

  async advanceTimeout(jobId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/operator/jobs/${jobId}/advance-timeout`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `advance-timeout failed for job ${jobId}: ${response.status} ${body}`
      );
    }
  }
}
