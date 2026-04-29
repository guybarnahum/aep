/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveServiceBaseUrl } from "../../../lib/service-map";
import { resolveEmployeeIdsByKey } from "../../lib/employee-resolution";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

const CHECK_NAME = "external-style-message-idempotency-check";
const CHECK_LABEL = "external-style message idempotency check";
const EXTERNAL_MESSAGE_ID = "ext-duplicate-message-001";

async function loadRecentTasks(
  client: ReturnType<typeof createOperatorAgentClient>,
): Promise<Record<string, unknown>[]> {
  const tasks: Record<string, unknown>[] = [];

  for (const status of ["ready", "in_progress", "completed", "failed", "blocked"] as const) {
    const response = await client.listTasks({ status, limit: 30 });
    if (!response?.ok) {
      continue;
    }

    if (Array.isArray(response.tasks)) {
      tasks.push(...(response.tasks as Record<string, unknown>[]));
    }
  }

  return tasks;
}

async function findSuitableThread(
  client: ReturnType<typeof createOperatorAgentClient>,
): Promise<{ threadId: string; taskId: string } | null> {
  const tasks = await loadRecentTasks(client);

  for (const task of tasks) {
    if (typeof task.id !== "string") {
      continue;
    }

    const threads = await client.listMessageThreads({ relatedTaskId: task.id, limit: 20 });
    if (!threads?.ok || !Array.isArray(threads.threads) || threads.threads.length === 0) {
      continue;
    }

    for (const thread of threads.threads as Array<Record<string, unknown>>) {
      if (typeof thread.id !== "string") {
        continue;
      }

      const detail = await client.getMessageThread(thread.id);
      if (detail?.ok && Array.isArray(detail.messages)) {
        return { threadId: thread.id, taskId: task.id };
      }
    }
  }

  return null;
}

async function countMatchingMessages(args: {
  client: ReturnType<typeof createOperatorAgentClient>;
  threadId: string;
}): Promise<{ count: number; matching: Record<string, unknown>[] }> {
  const detail = await args.client.getMessageThread(args.threadId);
  if (!detail?.ok || !Array.isArray(detail.messages)) {
    throw new Error(`Failed to fetch thread detail: ${JSON.stringify(detail)}`);
  }

  const matching = (detail.messages as Record<string, unknown>[]).filter(
    (message) => message.externalMessageId === EXTERNAL_MESSAGE_ID,
  );

  return {
    count: matching.length,
    matching,
  };
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
  const liveEmployeeIds = await resolveEmployeeIdsByKey({
    agentBaseUrl,
    employees: [
      {
        key: "infraOpsManager",
        roleId: "infra-ops-manager",
        teamId: "team_infra",
        runtimeStatus: "implemented",
      },
    ],
  });
  const infraOpsManagerEmployeeId = liveEmployeeIds.infraOpsManager;

  try {
    await client.endpointExists("/agent/messages");
  } catch (error) {
    if (handleOperatorAgentSoftSkip(CHECK_NAME, error)) {
      process.exit(0);
    }
    throw error;
  }

  const target = await findSuitableThread(client);
  if (!target) {
    softSkip("no suitable live thread with related task available");
  }

  await client.createMessage({
    companyId: "company_internal_aep",
    threadId: target.threadId,
    senderEmployeeId: infraOpsManagerEmployeeId,
    receiverEmployeeId: infraOpsManagerEmployeeId,
    type: "coordination",
    source: "human",
    body: "Duplicate-tolerant external-style message ingestion probe.",
    externalChannel: "email",
    externalMessageId: EXTERNAL_MESSAGE_ID,
    externalAuthorId: "external_author_person",
    externalReceivedAt: new Date().toISOString(),
    relatedTaskId: target.taskId,
  });

  await client.createMessage({
    companyId: "company_internal_aep",
    threadId: target.threadId,
    senderEmployeeId: infraOpsManagerEmployeeId,
    receiverEmployeeId: infraOpsManagerEmployeeId,
    type: "coordination",
    source: "human",
    body: "Duplicate-tolerant external-style message ingestion probe.",
    externalChannel: "email",
    externalMessageId: EXTERNAL_MESSAGE_ID,
    externalAuthorId: "external_author_person",
    externalReceivedAt: new Date().toISOString(),
    relatedTaskId: target.taskId,
  });

  const result = await countMatchingMessages({
    client,
    threadId: target.threadId,
  });

  if (result.count !== 1) {
    throw new Error(
      `Expected exactly one canonical message for ${EXTERNAL_MESSAGE_ID}, found ${result.count}`,
    );
  }

  const [message] = result.matching;
  if (message.externalChannel !== "email") {
    throw new Error(`Expected externalChannel=email, got ${JSON.stringify(message)}`);
  }

  console.log(`- PASS: ${CHECK_LABEL}`);
  console.log(`${CHECK_NAME} passed`, {
    threadId: target.threadId,
    taskId: target.taskId,
    externalMessageId: EXTERNAL_MESSAGE_ID,
    persistedMessageId: message.id,
  });
}

main().catch((error) => {
  console.error(`${CHECK_NAME} failed`);
  console.error(error);
  process.exit(1);
});