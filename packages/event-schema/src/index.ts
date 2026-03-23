import type { Provider } from "../../../packages/shared/src";

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

export type TeardownMode = "sync" | "async";

export interface StartWorkflowRequest {
  tenant_id: string;
  project_id: string;
  repo_url: string;
  branch: string;
  service_name: string;
  provider?: Provider;
  teardown_mode?: TeardownMode;
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