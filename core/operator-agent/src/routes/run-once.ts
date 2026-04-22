import { getConfig } from "@aep/operator-agent/config";
import type { TestExecutionContext } from "@aep/operator-agent/types/execution-provenance";
import { executeEmployeeRun, toErrorResponse } from "@aep/operator-agent/lib/execute-employee-run";
import { COMPANY_INTERNAL_AEP } from "@aep/operator-agent/org/company";
import { TEAM_INFRA } from "@aep/operator-agent/org/teams";
import {
  resolveRuntimeEmployeeById,
  resolveRuntimeEmployeeByRole,
} from "@aep/operator-agent/persistence/d1/runtime-employee-resolver-d1";
import type { EmployeeRunRequest, OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleRunOnce(
  request: Request,
  env?: OperatorAgentEnv
): Promise<Response> {
  const config = getConfig(env);

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url = new URL(request.url);
  const requestedEmployeeId = url.searchParams.get("employeeId");
  if (!env?.OPERATOR_AGENT_DB) {
    return Response.json(
      {
        ok: false,
        error: "OPERATOR_AGENT_DB is required for /agent/run-once",
      },
      { status: 503 },
    );
  }

  const employee = requestedEmployeeId
    ? await resolveRuntimeEmployeeById(env, requestedEmployeeId)
    : await resolveRuntimeEmployeeByRole({
        env,
        companyId: COMPANY_INTERNAL_AEP,
        teamId: TEAM_INFRA,
        roleId: "timeout-recovery-operator",
      });

  if (!employee) {
    return Response.json(
      {
        ok: false,
        error: requestedEmployeeId
          ? `Unknown active runtime employeeId: ${requestedEmployeeId}`
          : "Unable to resolve default timeout-recovery-operator",
      },
      { status: 404 },
    );
  }

  const runRequest: EmployeeRunRequest = {
    companyId: employee.identity.companyId,
    teamId: employee.identity.teamId,
    employeeId: employee.identity.employeeId,
    roleId: employee.identity.roleId,
    trigger: "manual",
    policyVersion: config.policyVersion,
  };

  try {
    const executionContext: TestExecutionContext = {
      executionSource: "test",
      receivedAt: Date.now(),
    };
    const result = await executeEmployeeRun(runRequest, env, executionContext);
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error, env);
  }
}
