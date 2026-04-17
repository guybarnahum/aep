import {
  approveEmployeePromptProfile,
} from "@aep/operator-agent/persistence/d1/employee-prompt-profile-store-d1";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleApproveEmployeePersona(
  request: Request,
  env: OperatorAgentEnv | undefined,
  employeeId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json(
      { ok: false, error: "Missing operator-agent environment" },
      { status: 500 },
    );
  }

  try {
    const approved = await approveEmployeePromptProfile(env, employeeId);
    return Response.json({
      ok: true,
      employeeId,
      promptProfileStatus: approved.status,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to approve employee persona",
      },
      { status: 400 },
    );
  }
}