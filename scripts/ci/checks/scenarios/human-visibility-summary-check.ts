/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";
import * as employeeIds from "../../shared/employee-ids";

export {};

const CHECK_NAME = "human-visibility-summary-check";
const CHECK_LABEL = "human visibility summary check";

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
    assignedEmployeeId: employeeIds.EMPLOYEE_RELIABILITY_ENGINEER_ID,
    createdByEmployeeId: employeeIds.EMPLOYEE_INFRA_OPS_MANAGER_ID,
    taskType: "validate-deployment",
    title: "Human visibility summary scenario check",
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
    topic: "Human visibility summary thread",
    createdByEmployeeId: employeeIds.EMPLOYEE_INFRA_OPS_MANAGER_ID,
    relatedTaskId: task.taskId,
    visibility: "org",
  });

  if (!thread?.ok || !thread?.threadId) {
    throw new Error(`Failed to create related thread: ${JSON.stringify(thread)}`);
  }

  const runResult = await client.runEmployee<any>({
    companyId: "company_internal_aep",
    teamId: "team_validation",
    employeeId: employeeIds.EMPLOYEE_RELIABILITY_ENGINEER_ID,
    roleId: "reliability-engineer",
    trigger: "manual",
    policyVersion: "ci-human-visibility-summary-check",
    taskId: task.taskId,
  });

  if (!runResult?.ok || runResult?.status !== "completed") {
    throw new Error(`Expected completed validation run, got ${JSON.stringify(runResult)}`);
  }

  const taskDetail = await client.getTask(task.taskId);
  const threadDetail = await client.getMessageThread(thread.threadId);

  if (!taskDetail?.ok || !taskDetail?.visibilitySummary) {
    throw new Error(`Expected task visibilitySummary, got ${JSON.stringify(taskDetail)}`);
  }

  if (!threadDetail?.ok || !threadDetail?.visibilitySummary) {
    throw new Error(`Expected thread visibilitySummary, got ${JSON.stringify(threadDetail)}`);
  }

  const taskSummary = taskDetail.visibilitySummary;
  const threadSummary = threadDetail.visibilitySummary;

  assert(taskSummary.relatedThreadCount >= 1, `Expected taskSummary.relatedThreadCount >= 1, got ${JSON.stringify(taskSummary)}`);
  assert(taskSummary.hasValidationResultArtifact === true, `Expected validation result artifact in task summary, got ${JSON.stringify(taskSummary)}`);
  assert(taskSummary.hasPublicRationaleArtifact === true, `Expected public rationale artifact in task summary, got ${JSON.stringify(taskSummary)}`);

  assert(threadSummary.relatedTaskId === task.taskId, `Expected threadSummary.relatedTaskId=${task.taskId}, got ${JSON.stringify(threadSummary)}`);
  assert(threadSummary.messageCount >= 1, `Expected threadSummary.messageCount >= 1, got ${JSON.stringify(threadSummary)}`);
  assert(threadSummary.hasPublicRationalePublication === true, `Expected threadSummary.hasPublicRationalePublication=true, got ${JSON.stringify(threadSummary)}`);
  assert(typeof threadSummary.latestPublicRationalePresentationStyle === "string", `Expected latestPublicRationalePresentationStyle, got ${JSON.stringify(threadSummary)}`);

  const rationaleArtifact = (taskDetail.artifacts ?? []).find((artifact: any) => artifact?.content?.kind === "public_rationale");
  const rationaleStyle = rationaleArtifact?.content?.presentationStyle;

  assert(
    threadSummary.latestPublicRationalePresentationStyle === rationaleStyle,
    `Expected thread/public rationale style alignment, got thread=${threadSummary.latestPublicRationalePresentationStyle} task=${String(rationaleStyle)}`,
  );

  assertFieldsAbsent(taskSummary, FORBIDDEN_PUBLIC_FIELDS, `/agent/tasks/${task.taskId} visibilitySummary`);
  assertFieldsAbsent(threadSummary, FORBIDDEN_PUBLIC_FIELDS, `/agent/message-threads/${thread.threadId} visibilitySummary`);

  console.log(`- PASS: ${CHECK_LABEL}`);
  console.log(`${CHECK_NAME} passed`, {
    taskId: task.taskId,
    threadId: thread.threadId,
    taskSummary,
    threadSummary,
  });
}

main().catch((error) => {
  console.error(`${CHECK_NAME} failed`);
  console.error(error);
  process.exit(1);
});