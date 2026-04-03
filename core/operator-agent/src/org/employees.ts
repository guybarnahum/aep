import { COMPANY_INTERNAL_AEP } from "@aep/operator-agent/org/company";
import { SERVICE_CONTROL_PLANE } from "@aep/operator-agent/org/services";
import { TEAM_INFRA } from "@aep/operator-agent/org/teams";
import type { AgentEmployeeDefinition, AgentRoleId } from "@aep/operator-agent/types";

export const timeoutRecoveryEmployee: AgentEmployeeDefinition = {
  identity: {
    employeeId: "emp_timeout_recovery_01",
    employeeName: "Timeout Recovery Operator",
    companyId: COMPANY_INTERNAL_AEP,
    teamId: TEAM_INFRA,
    roleId: "timeout-recovery-operator",
    managerRoleId: "infra-ops-manager",
  },
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

export const retrySupervisorEmployee: AgentEmployeeDefinition = {
  identity: {
    employeeId: "emp_retry_supervisor_01",
    employeeName: "Retry Supervisor",
    companyId: COMPANY_INTERNAL_AEP,
    teamId: TEAM_INFRA,
    roleId: "retry-supervisor",
    managerRoleId: "infra-ops-manager",
  },
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

export const infraOpsManagerEmployee: AgentEmployeeDefinition = {
  identity: {
    employeeId: "emp_infra_ops_manager_01",
    employeeName: "Infra Ops Manager",
    companyId: COMPANY_INTERNAL_AEP,
    teamId: TEAM_INFRA,
    roleId: "infra-ops-manager",
  },
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

export const operatorEmployees: AgentEmployeeDefinition[] = [
  timeoutRecoveryEmployee,
  retrySupervisorEmployee,
  infraOpsManagerEmployee,
];

export function getEmployeeById(
  employeeId: string
): AgentEmployeeDefinition | undefined {
  return operatorEmployees.find(
    (employee) => employee.identity.employeeId === employeeId
  );
}

export function getEmployeeByRole(
  roleId: AgentRoleId
): AgentEmployeeDefinition | undefined {
  return operatorEmployees.find(
    (employee) => employee.identity.roleId === roleId
  );
}
