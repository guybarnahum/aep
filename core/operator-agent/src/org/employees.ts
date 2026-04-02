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

export const retrySupervisorEmployee: AgentEmployeeDefinition = {
  identity: {
    employeeId: "emp_retry_supervisor_01",
    employeeName: "Retry Supervisor",
    departmentId: "aep-infra-ops",
    roleId: "retry-supervisor",
    managerRoleId: "infra-ops-manager",
  },
  authority: {
    allowedOperatorActions: ["advance-timeout"],
    allowedTenants: ["qa", "internal-aep"],
    allowedServices: ["control-plane"],
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
    departmentId: "aep-infra-ops",
    roleId: "infra-ops-manager",
  },
  authority: {
    allowedOperatorActions: ["advance-timeout"],
    allowedTenants: ["dev", "qa", "internal-aep"],
    allowedServices: ["control-plane"],
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
