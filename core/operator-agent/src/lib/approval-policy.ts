import type { ApprovalPolicyResolved } from "@aep/operator-agent/types";

const DEFAULT_APPROVAL_POLICY: ApprovalPolicyResolved = {
  actionType: "unknown",
  required: false,
  ttlMs: 0,
  singleUse: false,
};

const POLICY_BY_ACTION: Record<
  string,
  Omit<ApprovalPolicyResolved, "actionType">
> = {
  disable_employee: {
    required: true,
    ttlMs: 1000 * 60 * 60 * 24,
    singleUse: true,
  },
  restrict_employee: {
    required: true,
    ttlMs: 1000 * 60 * 60 * 24,
    singleUse: true,
  },
};

export function getApprovalPolicy(actionType: string): ApprovalPolicyResolved {
  const resolved = POLICY_BY_ACTION[actionType];
  if (!resolved) {
    return {
      ...DEFAULT_APPROVAL_POLICY,
      actionType,
    };
  }

  return {
    actionType,
    ...resolved,
  };
}
