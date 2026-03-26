import type { EscalationRecord, EscalationState } from "@aep/operator-agent/types";

const validTransitions: Record<EscalationState, EscalationState[]> = {
  open: ["acknowledged"],
  acknowledged: ["resolved"],
  resolved: [],
};

export function assertValidTransition(
  from: EscalationState,
  to: EscalationState
): void {
  if (!validTransitions[from].includes(to)) {
    throw new Error(`Invalid escalation transition: ${from} → ${to}`);
  }
}

export function applyAcknowledged(
  escalation: EscalationRecord,
  actor: string
): EscalationRecord {
  assertValidTransition(escalation.state, "acknowledged");

  return {
    ...escalation,
    state: "acknowledged",
    acknowledgedAt: new Date().toISOString(),
    acknowledgedBy: actor,
  };
}

export function applyResolved(
  escalation: EscalationRecord,
  actor: string,
  note?: string
): EscalationRecord {
  assertValidTransition(escalation.state, "resolved");

  return {
    ...escalation,
    state: "resolved",
    resolvedAt: new Date().toISOString(),
    resolvedBy: actor,
    resolutionNote: note,
  };
}
