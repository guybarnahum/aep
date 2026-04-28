import type { EmployeeMessage } from "../lib/store-types";

export const PRODUCT_DECISION_MESSAGE_KINDS = [
  "product_decision_recorded",
  "product_rationale_published",
  "product_priority_changed",
  "product_conversion_decision",
  "product_human_intervention",
] as const;

export type ProductDecisionMessageKind =
  (typeof PRODUCT_DECISION_MESSAGE_KINDS)[number];

export function isProductDecisionMessage(message: EmployeeMessage): boolean {
  const kind =
    typeof message.payload?.kind === "string" ? message.payload.kind : "";
  return PRODUCT_DECISION_MESSAGE_KINDS.includes(
    kind as ProductDecisionMessageKind,
  );
}