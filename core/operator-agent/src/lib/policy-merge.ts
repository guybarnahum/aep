import type { AgentAuthority, AgentBudget } from "@aep/operator-agent/types";

export function mergeBudget(
  base: AgentBudget,
  controlOverride?: Partial<AgentBudget>,
  requestOverride?: Partial<AgentBudget>
): AgentBudget {
  return {
    ...base,
    ...(controlOverride ?? {}),
    ...(requestOverride ?? {}),
  };
}

function narrowStringArray(
  base?: string[],
  overlay?: string[]
): string[] | undefined {
  if (!base && !overlay) {
    return undefined;
  }

  if (!base) {
    return overlay ? [...overlay] : undefined;
  }

  if (!overlay) {
    return [...base];
  }

  return base.filter((value) => overlay.includes(value));
}

export function mergeAuthority(
  base: AgentAuthority,
  controlOverride?: Partial<AgentAuthority>,
  requestOverride?: Partial<AgentAuthority>
): AgentAuthority {
  const controlMerged: AgentAuthority = {
    ...base,
    ...(controlOverride ?? {}),
    allowedTenants: narrowStringArray(
      base.allowedTenants,
      controlOverride?.allowedTenants
    ),
    allowedServices: narrowStringArray(
      base.allowedServices,
      controlOverride?.allowedServices
    ),
  };

  return {
    ...controlMerged,
    ...(requestOverride ?? {}),
    allowedTenants: narrowStringArray(
      controlMerged.allowedTenants,
      requestOverride?.allowedTenants
    ),
    allowedServices: narrowStringArray(
      controlMerged.allowedServices,
      requestOverride?.allowedServices
    ),
    requireTraceVerification:
      requestOverride?.requireTraceVerification ??
      controlMerged.requireTraceVerification,
    allowedOperatorActions: controlMerged.allowedOperatorActions,
  };
}
