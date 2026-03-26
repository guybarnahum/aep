import { getConfig } from "@aep/operator-agent/config";
import { executeEmployeeRun, toErrorResponse } from "@aep/operator-agent/lib/execute-employee-run";
import { timeoutRecoveryEmployee } from "@aep/operator-agent/org/employees";
import type { EmployeeRunRequest, OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleRunOnce(
  request: Request,
  env?: OperatorAgentEnv
): Promise<Response> {
  const config = getConfig(env);

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

  try {
    const result = await executeEmployeeRun(runRequest, env);
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error, env);
  }
}
