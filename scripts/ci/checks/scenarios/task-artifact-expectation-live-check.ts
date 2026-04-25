/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

const CHECK_NAME = "task-artifact-expectation-live-check";

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  try {
    await client.endpointExists("/agent/tasks");
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
    title: "PR16E artifact expectation fixture",
    payload: {
      environment: "staging",
      artifactRef: "artifact_pr16e_fixture",
    },
  });

  if (!created?.ok || typeof created.taskId !== "string") {
    throw new Error(`Failed to create fixture task: ${JSON.stringify(created)}`);
  }

  const detail = await client.getTask(created.taskId);

  if (!detail?.ok || !detail.artifactExpectations) {
    throw new Error(
      `Expected task detail to include artifactExpectations: ${JSON.stringify(detail)}`,
    );
  }

  if (detail.artifactExpectations.status !== "missing_expected_artifacts") {
    throw new Error(
      `Expected missing_expected_artifacts before evidence artifact exists: ${JSON.stringify(detail.artifactExpectations)}`,
    );
  }

  if (!detail.artifactExpectations.expectedArtifacts?.includes("evidence")) {
    throw new Error(
      `Expected deployment task to require evidence: ${JSON.stringify(detail.artifactExpectations)}`,
    );
  }

  console.log("task-artifact-expectation-live-check passed", {
    taskId: created.taskId,
    artifactExpectations: detail.artifactExpectations,
  });
}

void main().catch((error) => {
  console.error("task-artifact-expectation-live-check failed");
  console.error(error);
  process.exit(1);
});
