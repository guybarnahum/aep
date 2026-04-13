import type {
  CronFallbackExecutionContext,
  ExecutionContext,
  OperatorExecutionContext,
  PaperclipExecutionContext,
  TestExecutionContext,
} from "@aep/operator-agent/types/execution-provenance";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function parseExecutionContext(
  request: Request
): Promise<ExecutionContext> {
  const sourceHeader = request.headers.get("x-aep-execution-source");

  if (sourceHeader === "paperclip") {
    const body = await request.clone().json().catch(() => null) as
      | Record<string, unknown>
      | null;

    const companyId = body?.companyId;
    const taskId = body?.taskId ?? body?.workOrderId;
    const workOrderId = body?.workOrderId;
    const heartbeatId = body?.heartbeatId;
    const workflowKind = body?.workflowKind;
    const requestedBy = body?.requestedBy;

    if (
      !isNonEmptyString(companyId) ||
      !isNonEmptyString(taskId) ||
      !isNonEmptyString(heartbeatId)
    ) {
      throw new Error(
        "Invalid paperclip execution request: companyId, taskId, and heartbeatId are required"
      );
    }

    const ctx: PaperclipExecutionContext = {
      executionSource: "paperclip",
      companyId,
      taskId,
      workOrderId: isNonEmptyString(workOrderId) ? workOrderId : undefined,
      heartbeatId,
      workflowKind: isNonEmptyString(workflowKind) ? workflowKind : undefined,
      requestedBy: isNonEmptyString(requestedBy) ? requestedBy : undefined,
      receivedAt: Date.now(),
    };

    return ctx;
  }

  if (sourceHeader === "operator") {
    const actor = request.headers.get("x-actor") ?? undefined;
    const taskId = request.headers.get("x-aep-task-id") ?? undefined;
    const workOrderId = request.headers.get("x-aep-work-order-id") ?? undefined;

    const ctx: OperatorExecutionContext = {
      executionSource: "operator",
      actor,
      taskId: isNonEmptyString(taskId) ? taskId : undefined,
      workOrderId: isNonEmptyString(workOrderId) ? workOrderId : undefined,
      receivedAt: Date.now(),
    };

    return ctx;
  }

  if (sourceHeader === "test") {
    const taskId = request.headers.get("x-aep-task-id") ?? undefined;
    const workOrderId = request.headers.get("x-aep-work-order-id") ?? undefined;

    const ctx: TestExecutionContext = {
      executionSource: "test",
      taskId: isNonEmptyString(taskId) ? taskId : undefined,
      workOrderId: isNonEmptyString(workOrderId) ? workOrderId : undefined,
      receivedAt: Date.now(),
    };

    return ctx;
  }

  throw new Error("Missing or unsupported x-aep-execution-source");
}

export function makeCronFallbackContext(
  executorId: string
): CronFallbackExecutionContext {
  return {
    executionSource: "cron_fallback",
    executorId,
    trigger: "scheduled_tick",
    receivedAt: Date.now(),
  };
}
