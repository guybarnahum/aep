/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveServiceBaseUrl } from "../../../lib/service-map";
import { resolveEmployeeIdByRole } from "../../lib/employee-resolution";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

const CHECK_NAME = "repeated-pm-persona-continuity-check";
const CHECK_LABEL = "repeated PM persona continuity check";
let TARGET_EMPLOYEE_ID = "";
const EXPECTED_STYLE = "structured_alignment";
const FORBIDDEN_PRIVATE_FIELDS = [
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

async function loadCandidateTasks(
  client: ReturnType<typeof createOperatorAgentClient>,
): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];

  for (const status of ["completed", "failed"] as const) {
    const response = await client.listTasks({ status, limit: 50 });

    if (!response?.ok) {
      throw new Error(`Failed to list ${status} tasks: ${JSON.stringify(response)}`);
    }

    if (Array.isArray(response.tasks)) {
      results.push(...(response.tasks as Record<string, unknown>[]));
    }
  }

  return results;
}

async function findRepeatedSamples(
  client: ReturnType<typeof createOperatorAgentClient>,
): Promise<TaskSample[]> {
  const tasks = await loadCandidateTasks(client);
  const samples: TaskSample[] = [];
  const seenTaskIds = new Set<string>();

  for (const task of tasks) {
    if (typeof task.id !== "string" || seenTaskIds.has(task.id)) {
      continue;
    }

    const taskDetail = await client.getTask(task.id);
    if (!taskDetail?.ok) {
      continue;
    }

    const artifact = findPublicRationaleArtifact(taskDetail as Record<string, unknown>);
    if (!artifact || artifact.createdByEmployeeId !== TARGET_EMPLOYEE_ID) {
      continue;
    }

    if (!extractPresentationStyleFromArtifact(artifact)) {
      continue;
    }

    seenTaskIds.add(task.id);
    samples.push({
      taskId: task.id,
      taskDetail: taskDetail as Record<string, unknown>,
      artifact,
    });

    if (samples.length === 2) {
      break;
    }
  }

  return samples;
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
      assertFieldsAbsent(
        message,
        FORBIDDEN_PRIVATE_FIELDS,
        `/agent/message-threads/${thread.id}/messages[${index}]`,
      );

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

function softSkip(reason: string): never {
  console.warn(`- SKIP: ${CHECK_LABEL} (${reason})`);
  console.log(`${CHECK_NAME} skipped`, { reason });
  process.exit(0);
}

async function main(): Promise<void> {
  const client = createOperatorAgentClient();
  const agentBaseUrl = resolveServiceBaseUrl({
    envVar: "OPERATOR_AGENT_BASE_URL",
    serviceName: "operator-agent",
  });
  TARGET_EMPLOYEE_ID = await resolveEmployeeIdByRole({
    agentBaseUrl,
    roleId: "product-manager-web",
    teamId: "team_web_product",
    runtimeStatus: "planned",
    required: {
      scope: {
        allowedServices: ["service_dashboard"],
        allowedEnvironmentNames: ["preview"],
      },
    },
  });

  try {
    await client.endpointExists("/agent/tasks");
  } catch (error) {
    if (handleOperatorAgentSoftSkip(CHECK_NAME, error)) {
      process.exit(0);
    }
    throw error;
  }

  const samples = await findRepeatedSamples(client);

  if (samples.length < 2) {
    softSkip("fewer than two PM-created public rationale tasks with style-tagged artifacts are available");
  }

  const styles: string[] = [];
  const threadResults: Array<{ taskId: string; publicationObserved: boolean; threadIds: string[] }> = [];

  for (const sample of samples) {
    assertFieldsAbsent(sample.taskDetail, FORBIDDEN_PRIVATE_FIELDS, `/agent/tasks/${sample.taskId}`);
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
    throw new Error(`Repeated PM rationale styles did not match: ${styles[0]} vs ${styles[1]}`);
  }

  if (styles[0] !== EXPECTED_STYLE) {
    throw new Error(`Repeated PM rationale style expected ${EXPECTED_STYLE} but received ${styles[0]}`);
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