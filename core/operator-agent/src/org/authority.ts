import type { AgentAuthority } from "@aep/operator-agent/types";

export function cloneAuthority(authority: AgentAuthority): AgentAuthority {
  return {
    allowedOperatorActions: [...authority.allowedOperatorActions],
    allowedTenants: authority.allowedTenants ? [...authority.allowedTenants] : undefined,
    allowedServices: authority.allowedServices ? [...authority.allowedServices] : undefined,
    requireTraceVerification: authority.requireTraceVerification,
  };
}
