import type { StepName, WorkflowEvent } from "@aep/event-schema/index";
import { newId, nowIso } from "@aep/shared";

export async function emitEvent(
  db: D1Database,
  args: {
    traceId: string;
    workflowRunId: string;
    stepName?: StepName;
    eventType: string;
    payload: Record<string, unknown>;
  },
): Promise<WorkflowEvent> {
  const event: WorkflowEvent = {
    event_type: args.eventType,
    trace_id: args.traceId,
    workflow_run_id: args.workflowRunId,
    step_name: args.stepName,
    timestamp: nowIso(),
    payload: args.payload,
  };

  await db
    .prepare(
      `INSERT INTO events (id, trace_id, workflow_run_id, step_name, event_type, timestamp, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      newId("evt"),
      event.trace_id,
      event.workflow_run_id,
      event.step_name ?? null,
      event.event_type,
      event.timestamp,
      JSON.stringify(event.payload),
    )
    .run();

  return event;
}
