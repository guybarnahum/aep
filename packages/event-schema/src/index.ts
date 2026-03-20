export type WorkflowStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type StepName =
  | "INIT"
  | "CREATE_ENV"
  | "DEPLOY"
  | "HEALTH_CHECK"
  | "SMOKE_TEST"
  | "TEARDOWN"
  | "CLEANUP_AUDIT"
  | "COMPLETE";

export interface StartWorkflowRequest {
  tenant_id: string;
  project_id: string;
  repo_url: string;
  branch: string;
  service_name: string;
}

export interface EventPayload {
  [key: string]: unknown;
}

export interface WorkflowEvent {
  event_type: string;
  trace_id: string;
  workflow_run_id: string;
  step_name?: StepName;
  timestamp: string;
  payload: EventPayload;
}
