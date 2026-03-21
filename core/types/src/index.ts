import type { StartWorkflowRequest } from "../../../packages/event-schema/src/index";

export interface WorkflowCoordinatorDO {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  DB: D1Database;
  WORKFLOW_COORDINATOR: DurableObjectNamespace<WorkflowCoordinatorDO>;
  APP_ENV?: string;
  GIT_SHA?: string;
  SERVICE_NAME?: string;
}

export type WorkflowStartBody = StartWorkflowRequest;