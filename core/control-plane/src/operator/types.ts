export type RunStatus = "running" | "waiting" | "completed" | "failed";
export type JobStatus = "waiting" | "running" | "completed" | "failed" | null;

export type RuntimeProjectionSource =
  | "catalog"
  | "observed"
  | "catalog_enriched";

export type ProviderSource =
  | "catalog"
  | "inferred"
  | "observed";

export type AdvanceTimeoutReason =
  | "job_not_found"
  | "job_terminal"
  | "run_terminal"
  | "attempt_missing"
  | "attempt_not_timeout_eligible";

export type JobOperatorActions = {
  can_advance_timeout: boolean;
  advance_timeout_reason: AdvanceTimeoutReason | null;
};

export type RunSummary = {
  run_id: string;
  tenant_id: string;
  project_id: string;
  service_name: string;
  environment_name: string;
  repo_url: string | null;
  branch: string | null;
  provider: string | null;
  status: RunStatus;
  current_step: string | null;
  logical_job_type: string | null;
  logical_job_status: JobStatus;
  active_attempt: number | null;
  latest_failure_kind: string | null;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
  trace_id: string | null;
  trace_path: string;
};

export type RunAttemptView = {
  job_id: string;
  attempt: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  superseded_at: string | null;
  error_message: string | null;
  result_json: unknown;
};

export type RunJobView = {
  job_id: string;
  step_name: string;
  job_type: string;
  provider: string;
  status: JobStatus;
  active_attempt: number | null;
  max_attempts: number | null;
  attempt_count: number | null;
  terminal_attempt_no: number | null;
  next_retry_at: string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  result_json: unknown;
  operator_actions: JobOperatorActions;
  attempts: RunAttemptView[];
};

export type RunFailureView = {
  run_id: string;
  step: string | null;
  logical_job_type: string | null;
  attempt: number | null;
  failure_kind: string;
  failure_message: string | null;
  failure_payload: unknown;
};

export type RunDetail = RunSummary & {
  steps: Array<{
    step: string;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    error_message: string | null;
  }>;
  jobs: RunJobView[];
  failure: RunFailureView | null;
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
  source?: RuntimeProjectionSource;
  provider_source?: ProviderSource;
};

export type EnvironmentSummary = {
  tenant_id: string;
  service_id: string;
  environment_name: string;
};

export interface ServiceEnvironmentView {
  environment_name: string;
  latest_run: RunSummary | null;
  recent_runs?: RunSummary[];
  source?: RuntimeProjectionSource;
}