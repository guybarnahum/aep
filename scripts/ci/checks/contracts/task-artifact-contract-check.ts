/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  try {
    await client.endpointExists("/agent/tasks");
  } catch (err) {
    if (handleOperatorAgentSoftSkip("task-artifact-contract-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  const task = await client.createTask({
    companyId: "company_internal_aep",
    originatingTeamId: "team_infra",
    assignedTeamId: "team_validation",
    createdByEmployeeId: "emp_infra_ops_manager_01",
    taskType: "stage2-artifact-base",
    title: "Stage 2 artifact base task",
    payload: {
      source: "task-artifact-contract-check",
    },
  });

  if (!task?.ok || !task?.taskId) {
    throw new Error(`Failed to create artifact test task: ${JSON.stringify(task)}`);
  }

  const planArtifact = await client.createTaskArtifact(task.taskId, {
    companyId: "company_internal_aep",
    createdByEmployeeId: "emp_infra_ops_manager_01",
    artifactType: "plan",
    summary: "Initial execution plan",
    content: {
      steps: ["inspect", "validate", "report"],
    },
  });

  if (!planArtifact?.ok || !planArtifact?.artifactId) {
    throw new Error(`Failed to create plan artifact: ${JSON.stringify(planArtifact)}`);
  }

  const resultArtifact = await client.createTaskArtifact(task.taskId, {
    companyId: "company_internal_aep",
    createdByEmployeeId: "emp_infra_ops_manager_01",
    artifactType: "result",
    summary: "Execution result",
    content: {
      outcome: "passed",
    },
  });

  if (!resultArtifact?.ok || !resultArtifact?.artifactId) {
    throw new Error(`Failed to create result artifact: ${JSON.stringify(resultArtifact)}`);
  }

  const artifactsResponse = await client.listTaskArtifacts(task.taskId);

  if (!artifactsResponse?.ok) {
    throw new Error(`Failed to list artifacts: ${JSON.stringify(artifactsResponse)}`);
  }

  if (!Array.isArray(artifactsResponse.artifacts) || artifactsResponse.artifacts.length < 2) {
    throw new Error(
      `Expected at least 2 artifacts, got ${JSON.stringify(artifactsResponse.artifacts)}`,
    );
  }

  const taskDetail = await client.getTask(task.taskId);

  if (!taskDetail?.ok) {
    throw new Error(`Failed to fetch task detail: ${JSON.stringify(taskDetail)}`);
  }

  if (!Array.isArray(taskDetail.artifacts) || taskDetail.artifacts.length < 2) {
    throw new Error(
      `Expected task detail to include artifacts, got ${JSON.stringify(taskDetail.artifacts)}`,
    );
  }

  const planArtifacts = await client.listTaskArtifacts(task.taskId, {
    artifactType: "plan",
  });

  if (!planArtifacts?.ok) {
    throw new Error(`Failed to filter plan artifacts: ${JSON.stringify(planArtifacts)}`);
  }

  const hasPlanArtifact = Array.isArray(planArtifacts.artifacts)
    && planArtifacts.artifacts.some((artifact: any) => artifact.artifactType === "plan");

  if (!hasPlanArtifact) {
    throw new Error("Expected filtered artifact list to include a plan artifact");
  }

  console.log("task-artifact-contract-check passed", {
    taskId: task.taskId,
    planArtifactId: planArtifact.artifactId,
    resultArtifactId: resultArtifact.artifactId,
    artifactCount: artifactsResponse.artifacts.length,
  });
}

main().catch((error) => {
  console.error("task-artifact-contract-check failed");
  console.error(error);
  process.exit(1);
});