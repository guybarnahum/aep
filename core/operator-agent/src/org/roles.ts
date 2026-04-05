import type { AgentRoleId } from "@aep/operator-agent/types";

export const roles: Record<AgentRoleId, { id: AgentRoleId; name: string }> = {
  "timeout-recovery-operator": {
    id: "timeout-recovery-operator",
    name: "Timeout Recovery Operator",
  },
  "infra-ops-manager": {
    id: "infra-ops-manager",
    name: "Infra Operations Manager",
  },
  "retry-supervisor": {
    id: "retry-supervisor",
    name: "Retry Supervisor",
  },
  "teardown-safety-operator": {
    id: "teardown-safety-operator",
    name: "Teardown Safety Operator",
  },
  "incident-triage-operator": {
    id: "incident-triage-operator",
    name: "Incident Triage Operator",
  },
  "product-manager-web": {
    id: "product-manager-web",
    name: "Product Manager Web",
  },
  "frontend-engineer": {
    id: "frontend-engineer",
    name: "Frontend Engineer",
  },
  "validation-pm": {
    id: "validation-pm",
    name: "Validation PM",
  },
  "validation-engineer": {
    id: "validation-engineer",
    name: "Validation Engineer",
  },
  "reliability-engineer": {
    id: "reliability-engineer",
    name: "Site Reliability Engineer (Agent)",
  },
};
