import { executeEmployeeRun, toErrorResponse } from "../lib/execute-employee-run";
import type { EmployeeRunRequest, OperatorAgentEnv } from "../types";

export async function handleRun(
  request: Request,
  env?: OperatorAgentEnv
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        ok: false,
        status: "invalid_request",
        error: "Request body must be valid JSON",
      },
      { status: 400 }
    );
  }

  try {
    const result = await executeEmployeeRun(body as EmployeeRunRequest, env);
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error, env);
  }
}