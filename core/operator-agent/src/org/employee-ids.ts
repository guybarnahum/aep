import type { AgentRoleId } from "@aep/operator-agent/types";

const EMPLOYEE_ID_CODE_BY_ROLE: Record<AgentRoleId, string> = {
  "timeout-recovery-operator": "op",
  "infra-ops-manager": "mg",
  "retry-supervisor": "op",
  "teardown-safety-operator": "op",
  "incident-triage-operator": "op",
  "product-manager": "pm",
  "product-manager-web": "pm",
  "frontend-engineer": "dv",
  "validation-pm": "pm",
  "validation-engineer": "qa",
  "reliability-engineer": "qa",
};

export function employeeIdCodeForRole(roleId: AgentRoleId): string {
  return EMPLOYEE_ID_CODE_BY_ROLE[roleId];
}

export function formatCanonicalEmployeeId(
  employeeIdCode: string,
  sequence: number,
): string {
  if (!/^[a-z]{2}$/.test(employeeIdCode)) {
    throw new Error(`Invalid employee ID code: ${employeeIdCode}`);
  }

  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999) {
    throw new Error(`Invalid employee ID sequence: ${sequence}`);
  }

  return `${employeeIdCode}${String(sequence).padStart(3, "0")}`;
}

export function canonicalEmployeeIdForRole(
  roleId: AgentRoleId,
  sequence: number,
): string {
  return formatCanonicalEmployeeId(employeeIdCodeForRole(roleId), sequence);
}

export const EMPLOYEE_TIMEOUT_RECOVERY_ID = canonicalEmployeeIdForRole(
  "timeout-recovery-operator",
  1,
);
export const EMPLOYEE_RETRY_SUPERVISOR_ID = canonicalEmployeeIdForRole(
  "retry-supervisor",
  2,
);
export const EMPLOYEE_INFRA_OPS_MANAGER_ID = canonicalEmployeeIdForRole(
  "infra-ops-manager",
  1,
);
export const EMPLOYEE_PRODUCT_MANAGER_ID = canonicalEmployeeIdForRole(
  "product-manager",
  1,
);
export const EMPLOYEE_PRODUCT_MANAGER_WEB_ID = canonicalEmployeeIdForRole(
  "product-manager-web",
  2,
);
export const EMPLOYEE_VALIDATION_PM_ID = canonicalEmployeeIdForRole(
  "validation-pm",
  3,
);
export const EMPLOYEE_FRONTEND_ENGINEER_ID = canonicalEmployeeIdForRole(
  "frontend-engineer",
  1,
);
export const EMPLOYEE_VALIDATION_ENGINEER_ID = canonicalEmployeeIdForRole(
  "validation-engineer",
  1,
);
export const EMPLOYEE_RELIABILITY_ENGINEER_ID = canonicalEmployeeIdForRole(
  "reliability-engineer",
  2,
);

export const SEEDED_EMPLOYEE_IDS = [
  EMPLOYEE_TIMEOUT_RECOVERY_ID,
  EMPLOYEE_RETRY_SUPERVISOR_ID,
  EMPLOYEE_INFRA_OPS_MANAGER_ID,
  EMPLOYEE_PRODUCT_MANAGER_ID,
  EMPLOYEE_PRODUCT_MANAGER_WEB_ID,
  EMPLOYEE_FRONTEND_ENGINEER_ID,
  EMPLOYEE_VALIDATION_PM_ID,
  EMPLOYEE_VALIDATION_ENGINEER_ID,
  EMPLOYEE_RELIABILITY_ENGINEER_ID,
] as const;