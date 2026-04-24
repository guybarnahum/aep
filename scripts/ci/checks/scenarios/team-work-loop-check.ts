/* eslint-disable no-console */

import { getJson, postJson } from "../../shared/http";

type TeamLoopResult = {
  ok: true;
  status: "executed_task" | "no_pending_tasks" | "waiting_for_staffing";
  teamId: string;
  scanned: {
    pendingTasks: number;
    eligibleTasks: number;
  };
  taskId?: string;
  employeeId?: string;
  roleId?: string;
  message: string;
};

type TeamRunResponse = {
  ok: true;
  count: number;
  results: TeamLoopResult[];
};

function requireOperatorAgentBaseUrl(): string {
  const baseUrl = process.env.OPERATOR_AGENT_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("OPERATOR_AGENT_BASE_URL is required for team work loop check");
  }
  return baseUrl;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const baseUrl = requireOperatorAgentBaseUrl();

  const root = await getJson<{
    ok: true;
    links?: Record<string, string>;
  }>(`${baseUrl}/`);

  assert(root.ok === true, "operator-agent root did not return ok");
  assert(
    root.links?.teamsRun === "/agent/teams/run",
    "operator-agent root does not advertise teamsRun route",
  );

  const singleTeam = await postJson<TeamLoopResult>(
    `${baseUrl}/agent/teams/team_web_product/run-once`,
    { limit: 5 },
  );

  assert(singleTeam.ok === true, "single team run did not return ok");
  assert(
    singleTeam.teamId === "team_web_product",
    `unexpected single team result teamId: ${singleTeam.teamId}`,
  );
  assert(
    ["executed_task", "no_pending_tasks", "waiting_for_staffing"].includes(
      singleTeam.status,
    ),
    `unexpected single team status: ${singleTeam.status}`,
  );

  const allTeams = await postJson<TeamRunResponse>(
    `${baseUrl}/agent/teams/run`,
    {
      teamIds: ["team_infra", "team_web_product", "team_validation"],
      limit: 5,
    },
  );

  assert(allTeams.ok === true, "all team run did not return ok");
  assert(allTeams.count === 3, `expected 3 team results, got ${allTeams.count}`);
  assert(
    allTeams.results.every((result) =>
      ["team_infra", "team_web_product", "team_validation"].includes(
        result.teamId,
      ),
    ),
    "all team run returned an unexpected teamId",
  );

  let invalidTeamRejected = false;
  try {
    await postJson(`${baseUrl}/agent/teams/not_a_team/run-once`, { limit: 5 });
  } catch {
    invalidTeamRejected = true;
  }
  assert(invalidTeamRejected, "invalid team route should be rejected");

  console.log("- PASS: team loop root route is advertised");
  console.log("- PASS: single team loop route returns bounded status");
  console.log("- PASS: multi-team loop route returns one result per requested team");
  console.log("- PASS: invalid team IDs are rejected");
}

void main().catch((error) => {
  console.error("- FAIL: team work loop check failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});