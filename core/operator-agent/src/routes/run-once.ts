import { getConfig } from "../config";
import { runTimeoutRecoveryOperator } from "../agents/timeout-recovery";
import { timeoutRecoveryEmployee } from "../org/employees";
import type { EmployeeRunRequest } from "../types";

export async function handleRunOnce(
  request: Request,
  env?: Record<string, unknown>
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
    const result = await runTimeoutRecoveryOperator(runRequest, env);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      {
        ok: false,
        status: "control_plane_unavailable",
        policyVersion: config.policyVersion,
        controlPlaneBaseUrl: config.controlPlaneBaseUrl,
        error: message,
      },
      { status: 503 }
    );
  }
}
