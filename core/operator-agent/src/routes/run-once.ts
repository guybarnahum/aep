import { runTimeoutRecoveryOperator } from "../agents/timeout-recovery";
import { getConfig } from "../config";
import { timeoutRecoveryEmployee } from "../org/employees";
import type { EmployeeRunRequest } from "../types";

export async function handleRunOnce(request: Request): Promise<Response> {
  const config = getConfig();

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const employee = timeoutRecoveryEmployee;

  const runRequest: EmployeeRunRequest = {
    departmentId: employee.identity.departmentId,
    employeeId: employee.identity.employeeId,
    roleId: employee.identity.roleId,
    trigger: "manual",
    policyVersion: config.policyVersion,
  };

  const result = await runTimeoutRecoveryOperator(runRequest);
  return Response.json(result);
}
