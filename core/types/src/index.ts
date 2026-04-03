import type { StartWorkflowRequest } from "@aep/event-schema/index";

export interface Env {
  DB: D1Database;
  WORKFLOW_COORDINATOR: DurableObjectNamespace;
  APP_ENV?: string;
  GIT_SHA?: string;
  RUNTIME_READ_FAILURE_INJECTION_ENABLED?: string;
  SERVICE_NAME?: string;
  VALIDATION_LANE?: string;
}

export type WorkflowStartBody = StartWorkflowRequest;