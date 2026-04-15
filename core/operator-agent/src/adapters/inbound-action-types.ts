export type ExternalActionType =
  | "approval_approve"
  | "approval_reject"
  | "escalation_acknowledge"
  | "escalation_resolve";

export interface ExternalActionEnvelope {
  source: "slack" | "email";
  externalActionId: string;
  externalThreadId: string;
  externalAuthorId: string;
  receivedAt: string;
  actionType: ExternalActionType;
  metadata?: Record<string, unknown>;
}