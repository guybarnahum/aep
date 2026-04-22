import { COMPANY_INTERNAL_AEP, type CompanyId } from "@aep/operator-agent/org/company";
import { SERVICE_CONTROL_PLANE } from "@aep/operator-agent/org/services";
import {
  TEAM_INFRA,
  TEAM_VALIDATION,
  type TeamId,
} from "@aep/operator-agent/org/teams";
import type {
  AgentAuthority,
  AgentBudget,
  AgentEmployeeDefinition,
  AgentRoleId,
  EscalationPolicy,
} from "@aep/operator-agent/types";

export interface RuntimeRoleProfile {
  roleId: AgentRoleId;
  companyId: CompanyId;
  teamId: TeamId;
  managerRoleId?: AgentRoleId;
  authority: AgentAuthority;
  budget: AgentBudget;
  escalation: EscalationPolicy;
}

const timeoutRecoveryProfile: RuntimeRoleProfile = {
  roleId: "timeout-recovery-operator",
  companyId: COMPANY_INTERNAL_AEP,
  teamId: TEAM_INFRA,
  managerRoleId: "infra-ops-manager",
  authority: {
    allowedOperatorActions: ["advance-timeout"],
    allowedTenants: ["tenant_internal_aep", "tenant_qa"],
    allowedServices: [SERVICE_CONTROL_PLANE],
    requireTraceVerification: true,
  },
  budget: {
    maxActionsPerScan: 5,
    maxActionsPerHour: 30,
    maxActionsPerTenantPerHour: 10,
    tokenBudgetDaily: 0,
    runtimeBudgetMsPerScan: 5000,
    verificationReadsPerAction: 3,
  },
  escalation: {
    onBudgetExhausted: "notify-human",
    onRepeatedVerificationFailure: "notify-human",
    onProdTenantAction: "require-manager-approval",
  },
};

const retrySupervisorProfile: RuntimeRoleProfile = {
  roleId: "retry-supervisor",
  companyId: COMPANY_INTERNAL_AEP,
  teamId: TEAM_INFRA,
  managerRoleId: "infra-ops-manager",
  authority: {
    allowedOperatorActions: ["advance-timeout"],
    allowedTenants: ["tenant_qa", "tenant_internal_aep"],
    allowedServices: [SERVICE_CONTROL_PLANE],
    requireTraceVerification: true,
  },
  budget: {
    maxActionsPerScan: 2,
    maxActionsPerHour: 10,
    maxActionsPerTenantPerHour: 5,
    tokenBudgetDaily: 0,
    runtimeBudgetMsPerScan: 5000,
    verificationReadsPerAction: 3,
  },
  escalation: {
    onBudgetExhausted: "notify-human",
    onRepeatedVerificationFailure: "notify-human",
    onProdTenantAction: "require-manager-approval",
  },
};

const infraOpsManagerProfile: RuntimeRoleProfile = {
  roleId: "infra-ops-manager",
  companyId: COMPANY_INTERNAL_AEP,
  teamId: TEAM_INFRA,
  authority: {
    allowedOperatorActions: ["advance-timeout"],
    allowedTenants: ["tenant_internal_aep", "tenant_qa"],
    allowedServices: [SERVICE_CONTROL_PLANE],
    requireTraceVerification: false,
  },
  budget: {
    maxActionsPerScan: 0,
    maxActionsPerHour: 0,
    maxActionsPerTenantPerHour: 0,
    tokenBudgetDaily: 0,
    runtimeBudgetMsPerScan: 5000,
    verificationReadsPerAction: 0,
  },
  escalation: {
    onBudgetExhausted: "notify-human",
    onRepeatedVerificationFailure: "notify-human",
    onProdTenantAction: "require-manager-approval",
  },
};

const reliabilityEngineerProfile: RuntimeRoleProfile = {
  roleId: "reliability-engineer",
  companyId: COMPANY_INTERNAL_AEP,
  teamId: TEAM_VALIDATION,
  managerRoleId: "infra-ops-manager",
  authority: {
    allowedOperatorActions: ["execute-remediation", "propose-fix"],
    allowedTenants: ["tenant_internal_aep", "tenant_qa"],
    allowedServices: [SERVICE_CONTROL_PLANE],
    requireTraceVerification: true,
  },
  budget: {
    maxActionsPerScan: 3,
    maxActionsPerHour: 15,
    maxActionsPerTenantPerHour: 5,
    tokenBudgetDaily: 0,
    runtimeBudgetMsPerScan: 10000,
    verificationReadsPerAction: 5,
  },
  escalation: {
    onBudgetExhausted: "notify-human",
    onRepeatedVerificationFailure: "disable-agent",
    onProdTenantAction: "require-manager-approval",
  },
};

const runtimeRoleProfiles = new Map<AgentRoleId, RuntimeRoleProfile>([
  [timeoutRecoveryProfile.roleId, timeoutRecoveryProfile],
  [retrySupervisorProfile.roleId, retrySupervisorProfile],
  [infraOpsManagerProfile.roleId, infraOpsManagerProfile],
  [reliabilityEngineerProfile.roleId, reliabilityEngineerProfile],
]);

function cloneAuthority(authority: AgentAuthority): AgentAuthority {
  return {
    ...authority,
    allowedOperatorActions: [...authority.allowedOperatorActions],
    allowedTenants: authority.allowedTenants
      ? [...authority.allowedTenants]
      : undefined,
    allowedServices: authority.allowedServices
      ? [...authority.allowedServices]
      : undefined,
    allowedEnvironmentNames: authority.allowedEnvironmentNames
      ? [...authority.allowedEnvironmentNames]
      : undefined,
  };
}

function cloneBudget(budget: AgentBudget): AgentBudget {
  return { ...budget };
}

function cloneEscalation(escalation: EscalationPolicy): EscalationPolicy {
  return { ...escalation };
}

export function getRuntimeRoleProfile(
  roleId: AgentRoleId,
): RuntimeRoleProfile | undefined {
  return runtimeRoleProfiles.get(roleId);
}

export function buildRuntimeEmployeeDefinition(args: {
  employeeId: string;
  employeeName: string;
  companyId: CompanyId;
  teamId: TeamId;
  roleId: AgentRoleId;
  managerRoleId?: AgentRoleId;
}): AgentEmployeeDefinition | undefined {
  const profile = getRuntimeRoleProfile(args.roleId);

  if (!profile) {
    return undefined;
  }

  return {
    identity: {
      employeeId: args.employeeId,
      employeeName: args.employeeName,
      companyId: args.companyId,
      teamId: args.teamId,
      roleId: args.roleId,
      managerRoleId: args.managerRoleId ?? profile.managerRoleId,
    },
    authority: cloneAuthority(profile.authority),
    budget: cloneBudget(profile.budget),
    escalation: cloneEscalation(profile.escalation),
  };
}
