import type { EscalationPolicy } from "../types";

export function cloneEscalation(policy: EscalationPolicy): EscalationPolicy {
  return {
    onBudgetExhausted: policy.onBudgetExhausted,
    onRepeatedVerificationFailure: policy.onRepeatedVerificationFailure,
    onProdTenantAction: policy.onProdTenantAction,
  };
}
