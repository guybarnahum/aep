export type RunSummary = {
  run_id: string;
  tenant_id: string;
  project_id: string;
  service_name: string;
  environment_name: string;
  repo_url: string | null;
  branch: string | null;
  provider: string | null;
  status: "running" | "waiting" | "completed" | "failed";
  current_step: string | null;
  logical_job_type: string | null;
  logical_job_status: "waiting" | "running" | "completed" | "failed" | null;
  active_attempt: number | null;
  latest_failure_kind: string | null;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
  trace_id: string | null;
  trace_path: string;
};

export type TenantSummary = {
  tenant_id: string;
  name: string;
  service_count: number;
  environment_count: number;
  source?: "seeded" | "observed";
};

export type ServiceSummary = {
  tenant_id: string;
  service_id: string;
  service_name: string;
  provider: string | null;
  environments: string[];
};

export type TenantOverview = {
  tenant: TenantSummary;
  services: Array<{
    tenant_id: string;
    service_id: string;
    service_name: string;
    provider: string | null;
    environments: Array<{
      environment_name: string;
      latest_run: RunSummary | null;
    }>;
  }>;
};

export type ServiceOverview = {
  tenant: TenantSummary;
  service: ServiceSummary;
  environments: Array<{
    environment_name: string;
    latest_run: RunSummary | null;
    recent_runs: RunSummary[];
  }>;
};
