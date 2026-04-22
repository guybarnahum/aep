/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";
import * as employeeIds from "../../shared/employee-ids";

export {};

const CHECK_NAME = "repeated-validation-persona-continuity-check";
const CHECK_LABEL = "repeated validation persona continuity check";
const TARGET_EMPLOYEE_ID = employeeIds.EMPLOYEE_RELIABILITY_ENGINEER_ID;
const EXPECTED_STYLE = "operational_evidence";
const TARGET_TASK_TYPE = "validate-deployment";

const FORBIDDEN_PUBLIC_FIELDS = [
  "decisionStyle",
  "collaborationStyle",
  "identitySeed",
  "basePrompt",
  "promptVersion",
  "decision_style",
  "collaboration_style",
  "identity_seed",
  "base_prompt",
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

type TaskSample = {
  taskId: string;
  taskDetail: Record<string, unknown>;
  artifact: Record<string, unknown>;
};

function assertFieldsAbsent(payload: unknown, fields: string[], surface: string): void {
  const serialized = JSON.stringify(payload);

  for (const field of fields) {
    if (serialized.includes(field)) {
      throw new Error(`${surface} leaked private persona field ${field}`);
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

function findPublicRationaleArtifact(
  taskDetail: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const artifacts = Array.isArray(taskDetail.artifacts)
    ? (taskDetail.artifacts as Record<string, unknown>[])
    : [];

  return artifacts.find((artifact) => {
    const content =
      artifact.content && typeof artifact.content === "object"
        ? (artifact.content as Record<string, unknown>)
        : undefined;

    return content?.kind === "public_rationale";
  });
}

function extractPresentationStyleFromArtifact(
  artifact: Record<string, unknown>,
): string | undefined {
  const content =
    artifact.content && typeof artifact.content === "object"
      ? (artifact.content as Record<string, unknown>)
      : undefined;

  return typeof content?.presentationStyle === "string"
    ? content.presentationStyle
    : undefined;
}

function assertPublicRationaleArtifact(
  artifact: Record<string, unknown>,
  taskId: string,
): string {
  const content =
    artifact.content && typeof artifact.content === "object"
      ? (artifact.content as Record<string, unknown>)
      : undefined;

  if (content?.kind !== "public_rationale") {
    throw new Error(`Task ${taskId} missing canonical public_rationale artifact content`);
  }

  assertFieldsAbsent(
    content,
    FORBIDDEN_PUBLIC_FIELDS,
    `/agent/tasks/${taskId} public_rationale artifact`,
  );

  const style = extractPresentationStyleFromArtifact(artifact);
  if (!style) {
    throw new Error(`Task ${taskId} public_rationale artifact is missing presentationStyle`);
  }

  if (style !== EXPECTED_STYLE) {
    throw new Error(
      `Task ${taskId} public_rationale artifact expected ${EXPECTED_STYLE} but received ${style}`,
    );
  }

  return style;
}

async function createFreshValidationTask(
  client: ReturnType<typeof createOperatorAgentClient>,
  suffix: string,
): Promise<string> {
  const task = await client.createTask({
    companyId: "company_internal_aep",
    originatingTeamId: "team_infra",
    assignedTeamId: "team_validation",
    assignedEmployeeId: TARGET_EMPLOYEE_ID,
    createdByEmployeeId: employeeIds.EMPLOYEE_INFRA_OPS_MANAGER_ID,
    taskType: TARGET_TASK_TYPE,
    title: `Repeated validation persona continuity ${suffix}`,
    payload: {
      targetUrl: getTargetUrl(),
      source: CHECK_NAME,
      continuityRun: suffix,
      useControlPlaneBinding: false,
    },
  });

  if (!task?.ok || !task?.taskId) {
    throw new Error(`Failed to create validation task ${suffix}: ${JSON.stringify(task)}`);
  }

  return task.taskId;
}

async function runValidationTask(
  client: ReturnType<typeof createOperatorAgentClient>,
  taskId: string,
): Promise<Record<string, unknown>> {
  const runResult = await client.runEmployee<any>({
    companyId: "company_internal_aep",
    teamId: "team_validation",
    employeeId: TARGET_EMPLOYEE_ID,
    roleId: "reliability-engineer",
    trigger: "manual",
    policyVersion: "ci-repeated-validation-persona-continuity-check",
    taskId,
  });

  if (!runResult?.ok || runResult?.status !== "completed") {
    throw new Error(`Expected completed run response for ${taskId}, got ${JSON.stringify(runResult)}`);
  }

  const taskDetail = await client.getTask(taskId);
  if (!taskDetail?.ok) {
    throw new Error(`Failed to fetch task detail for ${taskId}: ${JSON.stringify(taskDetail)}`);
  }

  return taskDetail as Record<string, unknown>;
}

async function assertThreadStyleConsistency(args: {
  client: ReturnType<typeof createOperatorAgentClient>;
  taskId: string;
  expectedStyle: string;
}): Promise<{ publicationObserved: boolean; threadIds: string[] }> {
  const threads = await args.client.listMessageThreads({
    relatedTaskId: args.taskId,
    limit: 20,
  });

  if (!threads?.ok || !Array.isArray(threads.threads)) {
    return { publicationObserved: false, threadIds: [] };
  }

  let publicationObserved = false;
  const threadIds: string[] = [];

  for (const thread of threads.threads as Array<Record<string, unknown>>) {
    if (typeof thread.id !== "string") {
      continue;
    }

    const detail = await args.client.getMessageThread(thread.id);
    if (!detail?.ok || !Array.isArray(detail.messages)) {
      continue;
    }

    threadIds.push(thread.id);

    for (const [index, message] of (detail.messages as Array<Record<string, unknown>>).entries()) {
      if (typeof message.body === "string") {
        assertFieldsAbsent(
          message.body,
          FORBIDDEN_PUBLIC_FIELDS,
          `/agent/message-threads/${thread.id}/messages[${index}].body`,
        );
      }

      if (message.payload && typeof message.payload === "object") {
        assertFieldsAbsent(
          message.payload,
          FORBIDDEN_PUBLIC_FIELDS,
          `/agent/message-threads/${thread.id}/messages[${index}].payload`,
        );
      }

      const payload =
        message.payload && typeof message.payload === "object"
          ? (message.payload as Record<string, unknown>)
          : undefined;

      if (payload?.kind !== "public_rationale_publication") {
        continue;
      }

      publicationObserved = true;

      if (payload.presentationStyle !== args.expectedStyle) {
        throw new Error(
          `Thread rationale publication style mismatch for task ${args.taskId}: expected ${args.expectedStyle}, received ${String(payload.presentationStyle)}`,
        );
      }
    }
  }

  return { publicationObserved, threadIds };
}

async function createFreshSamples(
  client: ReturnType<typeof createOperatorAgentClient>,
): Promise<TaskSample[]> {
  const taskIds = [
    await createFreshValidationTask(client, "run-1"),
    await createFreshValidationTask(client, "run-2"),
  ];

  const samples: TaskSample[] = [];

  for (const taskId of taskIds) {
    const taskDetail = await runValidationTask(client, taskId);
    const artifact = findPublicRationaleArtifact(taskDetail);

    if (!artifact) {
      throw new Error(`Task ${taskId} missing public rationale artifact`);
    }

    samples.push({
      taskId,
      taskDetail,
      artifact,
    });
  }

  return samples;
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

  const samples = await createFreshSamples(client);

  const styles: string[] = [];
  const threadResults: Array<{ taskId: string; publicationObserved: boolean; threadIds: string[] }> = [];

  for (const sample of samples) {
    const style = assertPublicRationaleArtifact(sample.artifact, sample.taskId);
    styles.push(style);

    const threadResult = await assertThreadStyleConsistency({
      client,
      taskId: sample.taskId,
      expectedStyle: style,
    });
    threadResults.push({ taskId: sample.taskId, ...threadResult });
  }

  if (styles[0] !== styles[1]) {
    throw new Error(
      `Repeated validation rationale styles did not match: ${styles[0]} vs ${styles[1]}`,
    );
  }

  if (styles[0] !== EXPECTED_STYLE) {
    throw new Error(
      `Repeated validation rationale style expected ${EXPECTED_STYLE} but received ${styles[0]}`,
    );
  }

  console.log(`- PASS: ${CHECK_LABEL}`);
  console.log(`${CHECK_NAME} passed`, {
    taskIds: samples.map((sample) => sample.taskId),
    presentationStyles: styles,
    threadPublicationObserved: threadResults.map((result) => ({
      taskId: result.taskId,
      publicationObserved: result.publicationObserved,
      threadIds: result.threadIds,
    })),
  });
}

main().catch((error) => {
  console.error(`${CHECK_NAME} failed`);
  console.error(error);
  process.exit(1);
});