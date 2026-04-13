export type ExecutionSource =
  | "paperclip"
  | "cron_fallback"
  | "operator"
  | "test";

export interface PaperclipExecutionContext {
  executionSource: "paperclip";
  companyId: string;
  taskId: string;
  workOrderId?: string; // Legacy compatibility alias. taskId is canonical.
  heartbeatId: string;
  workflowKind?: string;
  requestedBy?: string;
  receivedAt: number;
}

export interface CronFallbackExecutionContext {
  executionSource: "cron_fallback";
  executorId: string;
  trigger: "scheduled_tick";
  taskId?: string;
  workOrderId?: string; // Legacy compatibility alias. taskId is canonical.
  receivedAt: number;
}

export interface OperatorExecutionContext {
  executionSource: "operator";
  actor?: string;
  taskId?: string;
  workOrderId?: string; // Legacy compatibility alias. taskId is canonical.
  receivedAt: number;
}

export interface TestExecutionContext {
  executionSource: "test";
  taskId?: string;
  workOrderId?: string; // Legacy compatibility alias. taskId is canonical.
  receivedAt: number;
}

export type ExecutionContext =
  | PaperclipExecutionContext
  | CronFallbackExecutionContext
  | OperatorExecutionContext
  | TestExecutionContext;
