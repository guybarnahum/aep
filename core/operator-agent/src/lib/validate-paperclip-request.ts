import type { PaperclipRunRequestEnvelope } from "@aep/operator-agent/types/paperclip-run-request";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validatePaperclipRunRequest(
  body: unknown
): asserts body is PaperclipRunRequestEnvelope {
  if (!body || typeof body !== "object") {
    throw new Error("Paperclip request body must be an object");
  }

  const typed = body as Record<string, unknown>;

  if (!isNonEmptyString(typed.companyId)) {
    throw new Error("Paperclip request missing companyId");
  }

  if (!isNonEmptyString(typed.taskId)) {
    throw new Error("Paperclip request missing taskId");
  }

  if (!isNonEmptyString(typed.heartbeatId)) {
    throw new Error("Paperclip request missing heartbeatId");
  }

  if (typed.workOrderId != null && !isNonEmptyString(typed.workOrderId)) {
    throw new Error("Paperclip request workOrderId must be a non-empty string");
  }

  if (typed.employeeId != null && !isNonEmptyString(typed.employeeId)) {
    throw new Error("Paperclip request employeeId must be a non-empty string");
  }

  if (typed.workerId != null && !isNonEmptyString(typed.workerId)) {
    throw new Error("Paperclip request workerId must be a non-empty string");
  }
}
