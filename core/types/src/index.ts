import type { StartWorkflowRequest } from "@aep/event-schema/index";

export interface Env {
  DB: D1Database;
  WORKFLOW_COORDINATOR: DurableObjectNamespace;
  APP_ENV?: string;
  GIT_SHA?: string;
  SERVICE_NAME?: string;
}

export type WorkflowStartBody = StartWorkflowRequest;