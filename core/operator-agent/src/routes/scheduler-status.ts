import {
  getOperatorSchedulerStatus,
  updateOperatorSchedulerCadence,
} from "@aep/operator-agent/lib/scheduler-state";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

type SchedulerCadenceUpdateBody = {
  teamTickIntervalMinutes?: unknown;
  managerTickIntervalMinutes?: unknown;
  updatedBy?: unknown;
};

function jsonError(error: string, status = 400): Response {
  return Response.json({ ok: false, error }, { status });
}

async function readOptionalJsonBody(
  request: Request,
): Promise<SchedulerCadenceUpdateBody> {
  try {
    return (await request.json()) as SchedulerCadenceUpdateBody;
  } catch {
    return {};
  }
}

export async function handleSchedulerStatus(
  request: Request,
  env?: OperatorAgentEnv
): Promise<Response> {
  if (request.method === "GET") {
    return Response.json(await getOperatorSchedulerStatus(env));
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env?.OPERATOR_AGENT_DB) {
    return jsonError("OPERATOR_AGENT_DB is required for scheduler cadence updates", 503);
  }

  const body = await readOptionalJsonBody(request);

  try {
    const status = await updateOperatorSchedulerCadence({
      env,
      teamTickIntervalMinutes: Number(body.teamTickIntervalMinutes),
      managerTickIntervalMinutes: Number(body.managerTickIntervalMinutes),
      updatedBy: String(body.updatedBy ?? ""),
    });

    return Response.json(status);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to update scheduler cadence",
      400,
    );
  }
}
