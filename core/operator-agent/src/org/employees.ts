import type { AgentEmployeeDefinition, AgentRoleId } from "@aep/operator-agent/types";

export const timeoutRecoveryEmployee: AgentEmployeeDefinition = {
  identity: {
    employeeId: "emp_timeout_recovery_01",
    employeeName: "Timeout Recovery Operator",
    departmentId: "aep-infra-ops",
    roleId: "timeout-recovery-operator",
    managerRoleId: "infra-ops-manager",
  },
  authority: {
    allowedOperatorActions: ["advance-timeout"],
    allowedTenants: ["dev", "qa", "internal-aep"],
    allowedServices: ["control-plane"],
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

export const operatorEmployees: AgentEmployeeDefinition[] = [
  timeoutRecoveryEmployee,
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
