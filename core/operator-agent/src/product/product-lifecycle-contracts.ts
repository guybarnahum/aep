import type { ProjectStatus } from "../lib/store-types";

export const PRODUCT_LIFECYCLE_ACTIONS = [
  "pause",
  "resume",
  "retire",
  "transition",
] as const;

export type ProductLifecycleAction = (typeof PRODUCT_LIFECYCLE_ACTIONS)[number];

export type ProductLifecycleDecisionState =
  | "requested"
  | "approval_pending"
  | "task_created";

export function isProductLifecycleAction(value: unknown): value is ProductLifecycleAction {
  return (
    typeof value === "string" &&
    PRODUCT_LIFECYCLE_ACTIONS.includes(value as ProductLifecycleAction)
  );
}

export function lifecycleTargetStatus(action: ProductLifecycleAction): ProjectStatus {
  switch (action) {
    case "pause":
      return "paused";
    case "resume":
      return "active";
    case "retire":
      return "archived";
    case "transition":
      return "completed";
  }
}

export function lifecycleApprovalActionType(action: ProductLifecycleAction): string {
  return `product_lifecycle_${action}`;
}
