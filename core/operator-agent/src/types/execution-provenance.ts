export type ExecutionSource =
  | "paperclip"
  | "cron_fallback"
  | "operator"
  | "test";

export interface PaperclipExecutionContext {
  executionSource: "paperclip";
  companyId: string;
  taskId: string;
  workOrderId?: string;
  heartbeatId: string;
  workflowKind?: string;
  requestedBy?: string;
  receivedAt: number;
}

export interface CronFallbackExecutionContext {
  executionSource: "cron_fallback";
  executorId: string;
  trigger: "scheduled_tick";
  workOrderId?: string;
  taskId?: string;
  receivedAt: number;
}

export interface OperatorExecutionContext {
  executionSource: "operator";
  actor?: string;
  workOrderId?: string;
  taskId?: string;
  receivedAt: number;
}

export interface TestExecutionContext {
  executionSource: "test";
  workOrderId?: string;
  taskId?: string;
  receivedAt: number;
}

export type ExecutionContext =
  | PaperclipExecutionContext
  | CronFallbackExecutionContext
  | OperatorExecutionContext
  | TestExecutionContext;
