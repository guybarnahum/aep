/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

const FORBIDDEN_PRIVATE_FIELDS = [
  "internalMonologue",
  "internal_monologue",
  "privateReasoning",
  "basePrompt",
  "decisionStyle",
  "collaborationStyle",
  "identitySeed",
  "portraitPrompt",
  "promptVersion",
  "base_prompt",
  "decision_style",
  "collaboration_style",
  "identity_seed",
  "portrait_prompt",
  "prompt_version",
  "intent",
  "riskLevel",
  "suggestedNextAction",
  "risk_level",
  "suggested_next_action",
];

function getTargetUrl(): string {
  return (
    process.env.CONTROL_PLANE_BASE_URL
    ?? process.env.OPERATOR_AGENT_BASE_URL
    ?? "https://example.com"
  );
}

function assertFieldsAbsent(payload: unknown, fields: string[], surface: string): void {
  const serialized = JSON.stringify(payload);

  for (const field of fields) {
    if (serialized.includes(field)) {
      throw new Error(`${surface} leaked private cognition field ${field}`);
    }
  }
}

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  try {
    await client.endpointExists("/agent/tasks");
  } catch (err) {
    if (handleOperatorAgentSoftSkip("public-rationale-artifact-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  const task = await client.createTask({
    companyId: "company_internal_aep",
    originatingTeamId: "team_infra",
    assignedTeamId: "team_validation",
    assignedEmployeeId: "emp_val_specialist_01",
    createdByEmployeeId: "emp_infra_ops_manager_01",
    taskType: "validate-deployment",
    title: "PR7.8C public rationale artifact task",
    payload: {
      targetUrl: getTargetUrl(),
      source: "public-rationale-artifact-check",
    },
  });

  if (!task?.ok || !task?.taskId) {
    throw new Error(`Failed to create task: ${JSON.stringify(task)}`);
  }

  const result = await client.runEmployee<any>({
    companyId: "company_internal_aep",
    teamId: "team_validation",
    employeeId: "emp_val_specialist_01",
    roleId: "reliability-engineer",
    trigger: "manual",
    policyVersion: "ci-public-rationale-artifact-check",
    taskId: task.taskId,
  });

  if (!result?.ok || result?.status !== "completed") {
    throw new Error(`Expected completed run response, got ${JSON.stringify(result)}`);
  }

  const taskDetail = await client.getTask(task.taskId);

  if (!taskDetail?.ok) {
    throw new Error(`Failed to fetch task detail: ${JSON.stringify(taskDetail)}`);
  }

  if (!Array.isArray(taskDetail.artifacts) || taskDetail.artifacts.length < 3) {
    throw new Error(
      `Expected plan + result + public rationale artifacts, got ${JSON.stringify(taskDetail.artifacts)}`,
    );
  }

  const rationaleArtifact = taskDetail.artifacts.find((artifact: any) => (
    artifact?.content?.kind === "public_rationale"
  ));

  if (!rationaleArtifact) {
    throw new Error(
      `Expected a public rationale artifact, got ${JSON.stringify(taskDetail.artifacts)}`,
    );
  }

  if (rationaleArtifact.artifactType !== "result") {
    throw new Error(
      `Expected public rationale artifactType=result, got ${rationaleArtifact.artifactType}`,
    );
  }

  if (typeof rationaleArtifact.content.summary !== "string" || !rationaleArtifact.content.summary.trim()) {
    throw new Error(`Expected non-empty rationale summary, got ${JSON.stringify(rationaleArtifact.content)}`);
  }

  if (typeof rationaleArtifact.content.rationale !== "string" || !rationaleArtifact.content.rationale.trim()) {
    throw new Error(`Expected non-empty rationale body, got ${JSON.stringify(rationaleArtifact.content)}`);
  }

  assertFieldsAbsent(
    rationaleArtifact.content,
    FORBIDDEN_PRIVATE_FIELDS,
    "/agent/tasks/:id public rationale artifact",
  );

  if (taskDetail.decision) {
    assertFieldsAbsent(
      taskDetail.decision,
      ["internalMonologue", "internal_monologue"],
      "/agent/tasks/:id decision",
    );
  }

  console.log("public-rationale-artifact-check passed", {
    taskId: task.taskId,
    artifactId: rationaleArtifact.id,
    artifactCount: taskDetail.artifacts.length,
  });
}

main().catch((error) => {
  console.error("public-rationale-artifact-check failed");
  console.error(error);
  process.exit(1);
});