import type { CompanyId } from "@aep/operator-agent/org/company";
import type { TeamId } from "@aep/operator-agent/org/teams";
import type {
  AgentAuthority,
  AgentBudget,
  AgentEmployeeDefinition,
  AgentRoleId,
  EscalationPolicy,
} from "@aep/operator-agent/types";

function cloneAuthority(authority: AgentAuthority): AgentAuthority {
  return {
    allowedOperatorActions: [...authority.allowedOperatorActions],
    requireTraceVerification: authority.requireTraceVerification,
    ...(authority.allowedTenants
      ? { allowedTenants: [...authority.allowedTenants] }
      : {}),
    ...(authority.allowedServices
      ? { allowedServices: [...authority.allowedServices] }
      : {}),
    ...(authority.allowedEnvironmentNames
      ? { allowedEnvironmentNames: [...authority.allowedEnvironmentNames] }
      : {}),
  };
}

function cloneBudget(budget: AgentBudget): AgentBudget {
  return { ...budget };
}

function cloneEscalation(escalation: EscalationPolicy): EscalationPolicy {
  return { ...escalation };
}

export function buildRuntimeEmployeeDefinition(args: {
  employeeId: string;
  employeeName: string;
  companyId: CompanyId;
  teamId: TeamId;
  roleId: AgentRoleId;
  managerRoleId?: AgentRoleId;
  authority: AgentAuthority;
  budget: AgentBudget;
  escalation: EscalationPolicy;
}): AgentEmployeeDefinition | undefined {
  return {
    identity: {
      employeeId: args.employeeId,
      employeeName: args.employeeName,
      companyId: args.companyId,
      teamId: args.teamId,
      roleId: args.roleId,
      managerRoleId: args.managerRoleId,
    },
    authority: cloneAuthority(args.authority),
    budget: cloneBudget(args.budget),
    escalation: cloneEscalation(args.escalation),
  };
}
