export type ExecutionSource =
  | "paperclip"
  | "cron_fallback"
  | "operator"
  | "test";

export interface PaperclipExecutionContext {
  executionSource: "paperclip";
  companyId: string;
  taskId: string;
  heartbeatId: string;
  workflowKind?: string;
  requestedBy?: string;
  receivedAt: number;
}

export interface CronFallbackExecutionContext {
  executionSource: "cron_fallback";
  workerId: string;
  trigger: "scheduled_tick";
  receivedAt: number;
}

export interface OperatorExecutionContext {
  executionSource: "operator";
  actor?: string;
  receivedAt: number;
}

export interface TestExecutionContext {
  executionSource: "test";
  receivedAt: number;
}

export type ExecutionContext =
  | PaperclipExecutionContext
  | CronFallbackExecutionContext
  | OperatorExecutionContext
  | TestExecutionContext;
