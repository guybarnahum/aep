/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

const CHECK_NAME = "team-loop-cognitive-scheduling-live-check";

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  try {
    await client.endpointExists("/agent/teams/team_infra/run-once");
  } catch (error) {
    if (handleOperatorAgentSoftSkip(CHECK_NAME, error)) {
      process.exit(0);
    }
    throw error;
  }

  const created = await client.createTask({
    companyId: "company_internal_aep",
    originatingTeamId: "team_web_product",
    assignedTeamId: "team_infra",
    createdByEmployeeId: CHECK_NAME,
    taskType: "deployment",
    title: "PR16D live cognitive scheduling fixture",
    payload: {
      environment: "staging",
      artifactRef: "artifact_pr16d_cognitive_fixture",
      priority: "high",
      urgency: "normal",
      deadline: "soon",
    },
  });

  if (!created?.ok || typeof created.taskId !== "string") {
    throw new Error(`Failed to create scheduling fixture: ${JSON.stringify(created)}`);
  }

  const response = await fetch(
    `${client.baseUrl.replace(/\/$/, "")}/agent/teams/team_infra/run-once`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: "company_internal_aep",
        limit: 25,
      }),
    },
  );

  const result = await response.json() as any;

  if (!result?.ok) {
    throw new Error(`Expected team loop ok response: ${JSON.stringify(result)}`);
  }

  const allowedStatuses = new Set([
    "executed_task",
    "waiting_for_staffing",
    "manager_review_requested",
    "no_pending_tasks",
    "execution_failed",
  ]);

  if (!allowedStatuses.has(result.status)) {
    throw new Error(`Unexpected team loop status: ${JSON.stringify(result)}`);
  }

  if (
    result.status !== "manager_review_requested"
    && result.taskId
    && result.taskId !== created.taskId
  ) {
    throw new Error(
      `Expected created fixture to be selected or manager review requested: ${JSON.stringify(result)}`,
    );
  }

  console.log("team-loop-cognitive-scheduling-live-check passed", {
    taskId: created.taskId,
    status: result.status,
    selectedTaskId: result.taskId ?? null,
  });
}

void main().catch((error) => {
  console.error("team-loop-cognitive-scheduling-live-check failed");
  console.error(error);
  process.exit(1);
});
