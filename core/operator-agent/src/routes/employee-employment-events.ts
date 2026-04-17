import { listEmployeeEmploymentEvents } from "@aep/operator-agent/lib/employee-lifecycle-store-d1";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleEmployeeEmploymentEvents(
  request: Request,
  env: OperatorAgentEnv | undefined,
  employeeId: string,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json(
      { ok: false, error: "Missing operator-agent environment" },
      { status: 500 },
    );
  }

  try {
    const events = await listEmployeeEmploymentEvents(env, employeeId);
    return Response.json({
      ok: true,
      employeeId,
      count: events.length,
      events,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to list employment events",
      },
      { status: 400 },
    );
  }
}