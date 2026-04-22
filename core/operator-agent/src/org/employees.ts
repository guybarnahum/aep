import { COMPANY_INTERNAL_AEP } from "@aep/operator-agent/org/company";
import {
  EMPLOYEE_INFRA_OPS_MANAGER_ID,
  EMPLOYEE_RELIABILITY_ENGINEER_ID,
  EMPLOYEE_RETRY_SUPERVISOR_ID,
  EMPLOYEE_TIMEOUT_RECOVERY_ID,
} from "@aep/operator-agent/org/employee-ids";
import { SERVICE_CONTROL_PLANE } from "@aep/operator-agent/org/services";
import { TEAM_INFRA, TEAM_VALIDATION } from "@aep/operator-agent/org/teams";
import type { AgentEmployeeDefinition, AgentRoleId } from "@aep/operator-agent/types";

export const timeoutRecoveryEmployee: AgentEmployeeDefinition = {
  identity: {
    employeeId: EMPLOYEE_TIMEOUT_RECOVERY_ID,
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
    employeeId: EMPLOYEE_RETRY_SUPERVISOR_ID,
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
    employeeId: EMPLOYEE_INFRA_OPS_MANAGER_ID,
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

// Keep this employee explicit so live scope probes can detect stale deployments.
export const reliabilityEngineerEmployee: AgentEmployeeDefinition = {
  identity: {
    employeeId: EMPLOYEE_RELIABILITY_ENGINEER_ID,
    employeeName: "Validation Specialist",
    companyId: COMPANY_INTERNAL_AEP,
    teamId: TEAM_VALIDATION,
    roleId: "reliability-engineer",
    managerRoleId: "infra-ops-manager",
  },
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

export const operatorEmployees: AgentEmployeeDefinition[] = [
  timeoutRecoveryEmployee,
  retrySupervisorEmployee,
  infraOpsManagerEmployee,
  reliabilityEngineerEmployee,
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
