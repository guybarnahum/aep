import { adaptPaperclipRequest, adaptPaperclipResponse } from "@aep/operator-agent/adapters/paperclip";
import { parseExecutionContext } from "@aep/operator-agent/lib/execution-context";
import { executeEmployeeRun, toErrorResponse } from "@aep/operator-agent/lib/execute-employee-run";
import { validatePaperclipAuth } from "@aep/operator-agent/lib/paperclip-auth";
import { validatePaperclipRunRequest } from "@aep/operator-agent/lib/validate-paperclip-request";
import type { ExecutionContext } from "@aep/operator-agent/types/execution-provenance";
import type {
  EmployeeRunRequest,
  OperatorAgentEnv,
  PaperclipRunRequest,
} from "@aep/operator-agent/types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function handleRun(
  request: Request,
  env?: OperatorAgentEnv
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: unknown;
  let executionContext: ExecutionContext;

  try {
    executionContext = await parseExecutionContext(request);
  } catch (err) {
    return Response.json(
      {
        ok: false,
        status: "invalid_request",
        error: err instanceof Error ? err.message : "Invalid execution source",
      },
      { status: 400 }
    );
  }

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
    const routing = {
      employeeId:
        typeof asRecord(body).employeeId === "string"
          ? (asRecord(body).employeeId as string)
          : null,
      workerId:
        typeof asRecord(body).workerId === "string"
          ? (asRecord(body).workerId as string)
          : null,
    };

    if (executionContext.executionSource === "paperclip") {
      try {
        validatePaperclipAuth(request, env);
        validatePaperclipRunRequest(body);
      } catch (err) {
        return Response.json(
          {
            ok: false,
            status: "invalid_request",
            error:
              err instanceof Error ? err.message : "Invalid Paperclip request",
          },
          { status: 400 }
        );
      }

      const paperclipPayload = body as PaperclipRunRequest;
      const adaptedRequest = adaptPaperclipRequest(paperclipPayload, env);
      const result = await executeEmployeeRun(adaptedRequest, env, executionContext);

      const paperclipResult = adaptPaperclipResponse({
        payload: paperclipPayload,
        request: adaptedRequest,
        result,
      });

      return Response.json(
        {
          ...paperclipResult,
          executionContext,
          routing,
        }
      );
    }

    const result = await executeEmployeeRun(
      body as EmployeeRunRequest,
      env,
      executionContext
    );
    return Response.json({
      ...result,
      executionContext,
      routing,
    });
  } catch (error) {
    return toErrorResponse(error, env);
  }
}