/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

const CHECK_NAME = "validation-loop-feedback-check";
const CHECK_LABEL = "validation loop feedback check";

const FORBIDDEN_PUBLIC_FIELDS = [
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
  "privateReasoning",
  "private_reasoning",
  "internalMonologue",
  "internal_monologue",
  "intent",
  "riskLevel",
  "suggestedNextAction",
  "risk_level",
  "suggested_next_action",
];

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertFieldsAbsent(payload: unknown, fields: string[], surface: string): void {
  const serialized = JSON.stringify(payload);

  for (const field of fields) {
    if (serialized.includes(field)) {
      throw new Error(`${surface} leaked private cognition field ${field}`);
    }
  }
}

function getTargetUrl(): string {
  return (
    process.env.CONTROL_PLANE_BASE_URL
    ?? process.env.OPERATOR_AGENT_BASE_URL
    ?? "https://example.com"
  );
}

function findArtifactByKind(
  taskDetail: Record<string, unknown>,
  kind: string,
): Record<string, unknown> | undefined {
  const artifacts = Array.isArray(taskDetail.artifacts)
    ? (taskDetail.artifacts as Record<string, unknown>[])
    : [];

  return artifacts.find((artifact) => {
    const content =
      artifact.content && typeof artifact.content === "object"
        ? (artifact.content as Record<string, unknown>)
        : undefined;

    return content?.kind === kind;
  });
}

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

  const task = await client.createTask({
    companyId: "company_internal_aep",
    originatingTeamId: "team_infra",
    assignedTeamId: "team_validation",
    assignedEmployeeId: "emp_val_specialist_01",
    createdByEmployeeId: "emp_infra_ops_manager_01",
    taskType: "validate-deployment",
    title: "Validation loop feedback scenario check",
    payload: {
      targetUrl: getTargetUrl(),
      source: CHECK_NAME,
      useControlPlaneBinding: false,
    },
  });

  if (!task?.ok || !task?.taskId) {
    throw new Error(`Failed to create validation task: ${JSON.stringify(task)}`);
  }

  const thread = await client.createMessageThread({
    companyId: "company_internal_aep",
    topic: "Validation loop feedback thread",
    createdByEmployeeId: "emp_infra_ops_manager_01",
    relatedTaskId: task.taskId,
    visibility: "org",
  });

  if (!thread?.ok || !thread?.threadId) {
    throw new Error(`Failed to create related thread for task ${task.taskId}: ${JSON.stringify(thread)}`);
  }

  const runResult = await client.runEmployee<any>({
    companyId: "company_internal_aep",
    teamId: "team_validation",
    employeeId: "emp_val_specialist_01",
    roleId: "reliability-engineer",
    trigger: "manual",
    policyVersion: "ci-validation-loop-feedback-check",
    taskId: task.taskId,
  });

  if (!runResult?.ok || runResult?.status !== "completed") {
    throw new Error(`Expected completed validation run, got ${JSON.stringify(runResult)}`);
  }

  const taskDetail = await client.getTask(task.taskId);
  if (!taskDetail?.ok || !taskDetail?.task) {
    throw new Error(`Failed to fetch task detail for ${task.taskId}: ${JSON.stringify(taskDetail)}`);
  }

  const validationArtifact = findArtifactByKind(taskDetail as Record<string, unknown>, "validation_result");
  if (!validationArtifact) {
    throw new Error(`Expected validation_result artifact on task ${task.taskId}`);
  }

  const validationContent =
    validationArtifact.content && typeof validationArtifact.content === "object"
      ? (validationArtifact.content as Record<string, unknown>)
      : undefined;

  assert(validationContent?.kind === "validation_result", `Expected validation_result artifact content, got ${JSON.stringify(validationContent)}`);
  assert(
    validationContent?.status === "pass" || validationContent?.status === "fail" || validationContent?.status === "warning",
    `Expected validation_result.status to be pass|fail|warning, got ${JSON.stringify(validationContent)}`,
  );
  assert(Array.isArray(validationContent?.findings), `Expected validation_result.findings array, got ${JSON.stringify(validationContent)}`);
  assertFieldsAbsent(
    validationContent,
    FORBIDDEN_PUBLIC_FIELDS,
    `/agent/tasks/${task.taskId} validation_result artifact`,
  );

  const rationaleArtifact = findArtifactByKind(taskDetail as Record<string, unknown>, "public_rationale");
  if (!rationaleArtifact) {
    throw new Error(`Expected public_rationale artifact on task ${task.taskId}`);
  }

  const rationaleContent =
    rationaleArtifact.content && typeof rationaleArtifact.content === "object"
      ? (rationaleArtifact.content as Record<string, unknown>)
      : undefined;

  assert(rationaleContent?.kind === "public_rationale", `Expected public_rationale content, got ${JSON.stringify(rationaleContent)}`);
  assertFieldsAbsent(
    rationaleContent,
    FORBIDDEN_PUBLIC_FIELDS,
    `/agent/tasks/${task.taskId} public_rationale artifact`,
  );

  assert(taskDetail.decision, `Expected task decision on task ${task.taskId}`);
  assert(
    typeof taskDetail.decision.reasoning === "string" && taskDetail.decision.reasoning.length > 0,
    `Expected decision.reasoning on task ${task.taskId}, got ${JSON.stringify(taskDetail.decision)}`,
  );

  const threadDetail = await client.getMessageThread(thread.threadId);
  if (!threadDetail?.ok || !Array.isArray(threadDetail.messages)) {
    throw new Error(`Failed to fetch thread detail for ${thread.threadId}: ${JSON.stringify(threadDetail)}`);
  }

  const rationalePublication = threadDetail.messages.find((message: any) =>
    message?.payload?.kind === "public_rationale_publication"
    && message?.relatedTaskId === task.taskId,
  );

  if (!rationalePublication) {
    throw new Error(`Expected public rationale publication message on thread ${thread.threadId}`);
  }

  assert(
    typeof rationalePublication.body === "string" && rationalePublication.body.length > 0,
    `Expected rationale publication body, got ${JSON.stringify(rationalePublication)}`,
  );

  assertFieldsAbsent(
    rationalePublication.body,
    FORBIDDEN_PUBLIC_FIELDS,
    `/agent/message-threads/${thread.threadId} rationale publication body`,
  );

  assertFieldsAbsent(
    rationalePublication.payload,
    FORBIDDEN_PUBLIC_FIELDS,
    `/agent/message-threads/${thread.threadId} rationale publication payload`,
  );

  console.log(`- PASS: ${CHECK_LABEL}`);
  console.log(`${CHECK_NAME} passed`, {
    taskId: task.taskId,
    threadId: thread.threadId,
    validationArtifactId: validationArtifact.id,
    rationaleArtifactId: rationaleArtifact.id,
    decisionVerdict: taskDetail.decision?.verdict,
  });
}

main().catch((error) => {
  console.error(`${CHECK_NAME} failed`);
  console.error(error);
  process.exit(1);
});