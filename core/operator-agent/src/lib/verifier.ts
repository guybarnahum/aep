import type { TraceEvent } from "../types";

function matchesJob(event: TraceEvent, jobId: string): boolean {
  if (event.job_id === jobId) {
    return true;
  }

  const payload = event.payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const payloadJobId = (payload as { job_id?: unknown }).job_id;
    if (typeof payloadJobId === "string" && payloadJobId === jobId) {
      return true;
    }
  }

  return false;
}

function eventType(event: TraceEvent): string | undefined {
  if (typeof event.type === "string") {
    return event.type;
  }

  if (typeof event.event_type === "string") {
    return event.event_type;
  }

  return undefined;
}

export function verifyAdvanceTimeoutApplied(
  trace: TraceEvent[],
  jobId: string
): { ok: boolean; evidence: string[] } {
  const evidence: string[] = [];

  const requested = trace.find(
    (event) =>
      eventType(event) === "operator.action_requested" && matchesJob(event, jobId)
  );
  if (requested) {
    evidence.push("operator.action_requested");
  }

  const applied = trace.find(
    (event) =>
      eventType(event) === "operator.action_applied" && matchesJob(event, jobId)
  );
  if (applied) {
    evidence.push("operator.action_applied");
  }

  return {
    ok: Boolean(requested && applied),
    evidence,
  };
}
