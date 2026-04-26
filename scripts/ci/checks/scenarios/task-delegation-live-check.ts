/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";
import { ciActor, ciArtifactMarker } from "../../shared/ci-artifacts";

const CHECK_NAME = "task-delegation-live-check";

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

  const source = await client.createTask({
    companyId: "company_internal_aep",
    originatingTeamId: "team_web_product",
    assignedTeamId: "team_web_product",
    createdByEmployeeId: ciActor(CHECK_NAME),
    taskType: "web_implementation",
    title: "PR16F delegation source fixture",
    payload: {
      ...ciArtifactMarker(CHECK_NAME),
      targetUrl: "https://example.invalid",
      requirementsRef: "task_requirements_fixture",
      projectId: "project_pr16f_fixture",
    },
  });

  if (!source?.ok || typeof source.taskId !== "string") {
    throw new Error(`Failed to create source task: ${JSON.stringify(source)}`);
  }

  const disallowedResponse = await fetch(
    `${client.baseUrl.replace(/\/$/, "")}/agent/tasks/${source.taskId}/delegate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        delegatedByEmployeeId: CHECK_NAME,
        taskType: "requirements_definition",
        title: "Invalid PR16F delegation",
        payload: {
          objectiveTitle: "Invalid",
          sourceRef: source.taskId,
        },
      }),
    },
  );

  const disallowed = await disallowedResponse.json() as any;
  if (disallowedResponse.status !== 400 || disallowed?.code !== "delegation_not_allowed") {
    throw new Error(
      `Expected disallowed delegation to fail: ${JSON.stringify(disallowed)}`,
    );
  }

  const allowedResponse = await fetch(
    `${client.baseUrl.replace(/\/$/, "")}/agent/tasks/${source.taskId}/delegate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        delegatedByEmployeeId: CHECK_NAME,
        taskType: "deployment",
        title: "PR16F delegated deployment fixture",
        payload: {
          ...ciArtifactMarker(CHECK_NAME),
          environment: "staging",
          artifactRef: source.taskId,
        },
      }),
    },
  );

  const allowed = await allowedResponse.json() as any;
  if (!allowed?.ok || typeof allowed.taskId !== "string") {
    throw new Error(`Expected allowed delegation to succeed: ${JSON.stringify(allowed)}`);
  }

  const detail = await client.getTask(allowed.taskId);
  if (!detail?.ok) {
    throw new Error(`Expected delegated task detail: ${JSON.stringify(detail)}`);
  }

  if (detail.task?.taskType !== "deployment") {
    throw new Error(`Expected delegated task type deployment: ${JSON.stringify(detail.task)}`);
  }

  if (detail.task?.payload?.sourceTaskId !== source.taskId) {
    throw new Error(
      `Expected delegated task payload to include sourceTaskId: ${JSON.stringify(detail.task?.payload)}`,
    );
  }

  if (detail.task?.payload?.projectId !== "project_pr16f_fixture") {
    throw new Error(
      `Expected delegated task to inherit projectId: ${JSON.stringify(detail.task?.payload)}`,
    );
  }

  console.log("task-delegation-live-check passed", {
    sourceTaskId: source.taskId,
    delegatedTaskId: allowed.taskId,
    threadId: allowed.threadId,
  });
}

void main().catch((error) => {
  console.error("task-delegation-live-check failed");
  console.error(error);
  process.exit(1);
});
