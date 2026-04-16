/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

const CHECK_NAME = "task-visibility-summary-check";
const CHECK_LABEL = "task visibility summary check";

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
    title: "Task visibility summary contract check",
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
    topic: "Task visibility summary thread",
    createdByEmployeeId: "emp_infra_ops_manager_01",
    relatedTaskId: task.taskId,
    visibility: "org",
  });

  if (!thread?.ok || !thread?.threadId) {
    throw new Error(`Failed to create related thread: ${JSON.stringify(thread)}`);
  }

  const runResult = await client.runEmployee<any>({
    companyId: "company_internal_aep",
    teamId: "team_validation",
    employeeId: "emp_val_specialist_01",
    roleId: "reliability-engineer",
    trigger: "manual",
    policyVersion: "ci-task-visibility-summary-check",
    taskId: task.taskId,
  });

  if (!runResult?.ok || runResult?.status !== "completed") {
    throw new Error(`Expected completed validation run, got ${JSON.stringify(runResult)}`);
  }

  const taskDetail = await client.getTask(task.taskId);
  if (!taskDetail?.ok || !taskDetail?.visibilitySummary) {
    throw new Error(`Expected visibilitySummary on task detail, got ${JSON.stringify(taskDetail)}`);
  }

  const summary = taskDetail.visibilitySummary;

  assert(summary.artifactCounts?.result >= 2, `Expected result artifact count >= 2, got ${JSON.stringify(summary)}`);
  assert(summary.hasPublicRationaleArtifact === true, `Expected hasPublicRationaleArtifact=true, got ${JSON.stringify(summary)}`);
  assert(summary.hasValidationResultArtifact === true, `Expected hasValidationResultArtifact=true, got ${JSON.stringify(summary)}`);
  assert(typeof summary.latestValidationStatus === "string", `Expected latestValidationStatus, got ${JSON.stringify(summary)}`);
  assert(typeof summary.latestDecisionVerdict === "string", `Expected latestDecisionVerdict, got ${JSON.stringify(summary)}`);
  assert(summary.relatedThreadCount >= 1, `Expected relatedThreadCount >= 1, got ${JSON.stringify(summary)}`);

  assert(Array.isArray(taskDetail.relatedThreads), `Expected relatedThreads array, got ${JSON.stringify(taskDetail)}`);
  assert(taskDetail.relatedThreads.some((entry: any) => entry.id === thread.threadId), `Expected created thread ${thread.threadId} in relatedThreads`);

  assertFieldsAbsent(summary, FORBIDDEN_PUBLIC_FIELDS, `/agent/tasks/${task.taskId} visibilitySummary`);
  assertFieldsAbsent(taskDetail.relatedThreads, FORBIDDEN_PUBLIC_FIELDS, `/agent/tasks/${task.taskId} relatedThreads`);

  console.log(`- PASS: ${CHECK_LABEL}`);
  console.log(`${CHECK_NAME} passed`, {
    taskId: task.taskId,
    threadId: thread.threadId,
    visibilitySummary: summary,
  });
}

main().catch((error) => {
  console.error(`${CHECK_NAME} failed`);
  console.error(error);
  process.exit(1);
});