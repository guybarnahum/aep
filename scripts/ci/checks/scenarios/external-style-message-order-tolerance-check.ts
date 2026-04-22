/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";
import * as employeeIds from "../../shared/employee-ids";

export {};

const CHECK_NAME = "external-style-message-order-tolerance-check";
const CHECK_LABEL = "external-style message order tolerance check";
const FIRST_ID = "pr79d-order-message-001";
const SECOND_ID = "pr79d-order-message-002";

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

function countMessagesByExternalId(
  messages: Record<string, unknown>[],
  externalMessageId: string,
): number {
  return messages.filter((message) => message.externalMessageId === externalMessageId).length;
}

function softSkip(reason: string): never {
  console.warn(`- SKIP: ${CHECK_LABEL} (${reason})`);
  console.log(`${CHECK_NAME} skipped`, { reason });
  process.exit(0);
}

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

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

  const beforeTaskDetail = await client.getTask(target.taskId);
  if (!beforeTaskDetail?.ok) {
    throw new Error(`Failed to fetch task detail before message inserts: ${JSON.stringify(beforeTaskDetail)}`);
  }

  const beforeArtifactCount = Array.isArray(beforeTaskDetail.artifacts)
    ? beforeTaskDetail.artifacts.length
    : 0;
  const beforeStatus = beforeTaskDetail.task?.status;

  await client.createMessage({
    companyId: "company_internal_aep",
    threadId: target.threadId,
    senderEmployeeId: employeeIds.EMPLOYEE_INFRA_OPS_MANAGER_ID,
    receiverEmployeeId: employeeIds.EMPLOYEE_INFRA_OPS_MANAGER_ID,
    type: "coordination",
    source: "human",
    body: "Second logical external-style message arrived first.",
    externalChannel: "slack",
    externalMessageId: SECOND_ID,
    externalAuthorId: "slack-user-later",
    externalReceivedAt: new Date(Date.now() + 5_000).toISOString(),
    relatedTaskId: target.taskId,
  });

  await client.createMessage({
    companyId: "company_internal_aep",
    threadId: target.threadId,
    senderEmployeeId: employeeIds.EMPLOYEE_INFRA_OPS_MANAGER_ID,
    receiverEmployeeId: employeeIds.EMPLOYEE_INFRA_OPS_MANAGER_ID,
    type: "coordination",
    source: "human",
    body: "First logical external-style message arrived second.",
    externalChannel: "slack",
    externalMessageId: FIRST_ID,
    externalAuthorId: "slack-user-earlier",
    externalReceivedAt: new Date().toISOString(),
    relatedTaskId: target.taskId,
  });

  const threadDetail = await client.getMessageThread(target.threadId);
  if (!threadDetail?.ok || !Array.isArray(threadDetail.messages)) {
    throw new Error(`Failed to fetch thread detail after message inserts: ${JSON.stringify(threadDetail)}`);
  }

  const messages = threadDetail.messages as Record<string, unknown>[];
  const firstCount = countMessagesByExternalId(messages, FIRST_ID);
  const secondCount = countMessagesByExternalId(messages, SECOND_ID);

  if (firstCount !== 1 || secondCount !== 1) {
    throw new Error(
      `Expected exactly one message for each external ID, got first=${firstCount} second=${secondCount}`,
    );
  }

  const inserted = messages.filter(
    (message) => message.externalMessageId === FIRST_ID || message.externalMessageId === SECOND_ID,
  );

  if (inserted.length !== 2) {
    throw new Error(`Expected exactly two inserted external-style messages, got ${inserted.length}`);
  }

  inserted.forEach((message) => {
    if (message.externalChannel !== "slack") {
      throw new Error(`Expected slack externalChannel on inserted message: ${JSON.stringify(message)}`);
    }
    if (typeof message.responseActionType !== "undefined") {
      throw new Error(`Inserted message must not infer response action: ${JSON.stringify(message)}`);
    }
    if (message.causedStateTransition === true) {
      throw new Error(`Inserted message must not cause state transition: ${JSON.stringify(message)}`);
    }
  });

  const afterTaskDetail = await client.getTask(target.taskId);
  if (!afterTaskDetail?.ok) {
    throw new Error(`Failed to fetch task detail after message inserts: ${JSON.stringify(afterTaskDetail)}`);
  }

  const afterArtifactCount = Array.isArray(afterTaskDetail.artifacts)
    ? afterTaskDetail.artifacts.length
    : 0;
  const afterStatus = afterTaskDetail.task?.status;

  if (beforeArtifactCount !== afterArtifactCount) {
    throw new Error(
      `External-style message ingestion changed artifact count for task ${target.taskId}: before=${beforeArtifactCount} after=${afterArtifactCount}`,
    );
  }

  if (beforeStatus !== afterStatus) {
    throw new Error(
      `External-style message ingestion changed task status for ${target.taskId}: before=${String(beforeStatus)} after=${String(afterStatus)}`,
    );
  }

  console.log(`- PASS: ${CHECK_LABEL}`);
  console.log(`${CHECK_NAME} passed`, {
    threadId: target.threadId,
    taskId: target.taskId,
    firstExternalMessageId: FIRST_ID,
    secondExternalMessageId: SECOND_ID,
  });
}

main().catch((error) => {
  console.error(`${CHECK_NAME} failed`);
  console.error(error);
  process.exit(1);
});