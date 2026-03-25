import { getConfig } from "../config";
import { cloneAuthority } from "../org/authority";
import { cloneBudget } from "../org/budgets";
import { timeoutRecoveryEmployee } from "../org/employees";
import type { EmployeeRunRequest, EmployeeRunResponse } from "../types";

export async function runTimeoutRecoveryOperator(
  req: EmployeeRunRequest,
): Promise<EmployeeRunResponse> {
  const config = getConfig();
  const employee = timeoutRecoveryEmployee;

  return {
    ok: true,
    status: "not_implemented",
    policyVersion: config.policyVersion,
    trigger: req.trigger,
    employee: employee.identity,
    authority: cloneAuthority(employee.authority),
    budget: cloneBudget(employee.budget),
    message:
      "Timeout Recovery Operator skeleton is active; observation/action logic will be added in later stages.",
  };
}
