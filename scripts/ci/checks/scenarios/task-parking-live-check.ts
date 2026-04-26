/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";
import { ciActor, ciArtifactMarker } from "../../shared/ci-artifacts";

const CHECK_NAME = "task-parking-live-check";

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
    assignedTeamId: "team_web_product",
    createdByEmployeeId: ciActor(CHECK_NAME),
    taskType: "analysis",
    title: "PR16D live parking fixture",
    payload: {
      ...ciArtifactMarker(CHECK_NAME),
      question: "Validate manager-mediated task parking.",
    },
  });

  if (!created?.ok || typeof created.taskId !== "string") {
    throw new Error(`Failed to create parking fixture: ${JSON.stringify(created)}`);
  }

  const missingManagerResponse = await fetch(
    `${client.baseUrl.replace(/\/$/, "")}/agent/tasks/${created.taskId}/park`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parkedByEmployeeId: CHECK_NAME,
        reason: "Missing manager decision should fail.",
      }),
    },
  );

  const missingManager = await missingManagerResponse.json() as any;
  if (missingManagerResponse.status !== 400 || missingManager?.ok !== false) {
    throw new Error(
      `Expected missing managerDecisionId to fail: ${JSON.stringify(missingManager)}`,
    );
  }

  const parkedResponse = await fetch(
    `${client.baseUrl.replace(/\/$/, "")}/agent/tasks/${created.taskId}/park`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parkedByEmployeeId: CHECK_NAME,
        reason: "Higher-priority live validation fixture.",
        managerDecisionId: `decision_${CHECK_NAME}`,
      }),
    },
  );

  const parked = await parkedResponse.json() as any;
  if (!parked?.ok || parked.status !== "parked") {
    throw new Error(`Expected park endpoint to succeed: ${JSON.stringify(parked)}`);
  }

  const detail = await client.getTask(created.taskId);
  if (!detail?.ok || detail.task?.status !== "parked") {
    throw new Error(`Expected task to be parked: ${JSON.stringify(detail)}`);
  }

  const auditThread = detail.relatedThreads?.find((thread: any) =>
    String(thread.topic ?? "").includes("Task parked")
  );

  if (!auditThread) {
    throw new Error(
      `Expected task parking audit thread linked to task: ${JSON.stringify(detail.relatedThreads)}`,
    );
  }

  console.log("task-parking-live-check passed", {
    taskId: created.taskId,
    auditThreadId: auditThread.id,
  });
}

void main().catch((error) => {
  console.error("task-parking-live-check failed");
  console.error(error);
  process.exit(1);
});
