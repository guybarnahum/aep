import { runTeamWorkLoop } from "@aep/operator-agent/lib/team-work-loop";
import type { CompanyId } from "@aep/operator-agent/org/company";
import { isTeamId, TEAM_IDS, type TeamId } from "@aep/operator-agent/org/teams";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

type TeamRunRequestBody = {
  companyId?: string;
  teamIds?: string[];
  limit?: number;
};

function jsonError(error: string, status = 400): Response {
  return Response.json({ ok: false, error }, { status });
}

async function readOptionalJsonBody(request: Request): Promise<TeamRunRequestBody> {
  try {
    return (await request.json()) as TeamRunRequestBody;
  } catch {
    return {};
  }
}

function parseLimit(limit: unknown): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return 20;
  }

  return Math.max(1, Math.min(50, Math.trunc(limit)));
}

function parseTeamIds(teamIds: unknown): TeamId[] | Response {
  if (teamIds === undefined) {
    return TEAM_IDS;
  }

  if (!Array.isArray(teamIds)) {
    return jsonError("teamIds must be an array of team IDs", 400);
  }

  if (teamIds.length === 0) {
    return jsonError("teamIds must not be empty", 400);
  }

  const parsed: TeamId[] = [];
  for (const teamId of teamIds) {
    if (typeof teamId !== "string" || !isTeamId(teamId)) {
      return jsonError(`Unsupported teamId: ${String(teamId)}`, 400);
    }
    parsed.push(teamId);
  }

  return parsed;
}

function requireD1(env?: OperatorAgentEnv): Response | undefined {
  if (!env?.OPERATOR_AGENT_DB) {
    return jsonError("OPERATOR_AGENT_DB is required for team loop routes", 503);
  }

  return undefined;
}

export async function handleRunTeams(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const d1Error = requireD1(env);
  if (d1Error) {
    return d1Error;
  }

  const body = await readOptionalJsonBody(request);
  const teamIds = parseTeamIds(body.teamIds);
  if (teamIds instanceof Response) {
    return teamIds;
  }

  const limit = parseLimit(body.limit);
  const results = [];

  try {
    for (const teamId of teamIds) {
      try {
        results.push(
          await runTeamWorkLoop({
            env: env as OperatorAgentEnv,
            companyId: body.companyId as CompanyId | undefined,
            teamId,
            limit,
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        
        // Log and include error in results instead of failing entire batch
        console.error(`Error running work loop for team ${teamId}:`, error);
        results.push({
          ok: false,
          teamId,
          error: message.includes("Failed to normalize taskType")
            ? `Data integrity error: ${message}`
            : `Error running team work loop: ${message}`,
        } as unknown as typeof results[0]);
      }
    }

    const allSuccessful = results.every((r) => (r as any)?.ok !== false);
    return Response.json({
      ok: allSuccessful,
      count: results.length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Unexpected error in handleRunTeams:", error);
    return jsonError(`Unexpected error while running teams: ${message}`, 500);
  }
}

export async function handleRunTeamOnce(
  request: Request,
  env: OperatorAgentEnv | undefined,
  teamId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const d1Error = requireD1(env);
  if (d1Error) {
    return d1Error;
  }

  if (!isTeamId(teamId)) {
    return jsonError(`Unsupported teamId: ${teamId}`, 400);
  }

  try {
    const body = await readOptionalJsonBody(request);
    const result = await runTeamWorkLoop({
      env: env as OperatorAgentEnv,
      companyId: body.companyId as CompanyId | undefined,
      teamId,
      limit: parseLimit(body.limit),
    });

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Data integrity errors
    if (message.includes("Failed to normalize taskType")) {
      return jsonError(
        `Data integrity error while loading team tasks: ${message}`,
        500,
      );
    }

    // Unexpected errors
    console.error(`Unexpected error in team run loop for ${teamId}:`, error);
    return jsonError(`Unexpected error while running team work loop: ${message}`, 500);
  }
}