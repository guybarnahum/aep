import { adaptPaperclipRequest, adaptPaperclipResponse, isPaperclipRunRequest } from "@aep/operator-agent/adapters/paperclip";
import { executeEmployeeRun, toErrorResponse } from "@aep/operator-agent/lib/execute-employee-run";
import type {
  EmployeeRunRequest,
  OperatorAgentEnv,
  PaperclipRunRequest,
} from "@aep/operator-agent/types";

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
    if (isPaperclipRunRequest(body)) {
      const paperclipPayload = body as PaperclipRunRequest;
      const adaptedRequest = adaptPaperclipRequest(paperclipPayload, env);
      const result = await executeEmployeeRun(adaptedRequest, env);

      return Response.json(
        adaptPaperclipResponse({
          payload: paperclipPayload,
          request: adaptedRequest,
          result,
        })
      );
    }

    const result = await executeEmployeeRun(body as EmployeeRunRequest, env);
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error, env);
  }
}