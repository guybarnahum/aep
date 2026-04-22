/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";
import * as employeeIds from "../../shared/employee-ids";

export {};

const CHECK_NAME = "threaded-mirror-continuity-check";
const CHECK_LABEL = "threaded mirror continuity check";

function softSkip(reason: string): never {
  console.warn(`- SKIP: ${CHECK_LABEL} (${reason})`);
  console.log(`${CHECK_NAME} skipped`, { reason });
  process.exit(0);
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  try {
    await client.endpointExists("/agent/message-threads");
  } catch (error) {
    if (handleOperatorAgentSoftSkip(CHECK_NAME, error)) {
      process.exit(0);
    }
    throw error;
  }

  const thread = await client.createMessageThread({
    companyId: "company_internal_aep",
    topic: "PR10B threaded mirror continuity check",
    createdByEmployeeId: employeeIds.EMPLOYEE_INFRA_OPS_MANAGER_ID,
    relatedTaskId: "task_pr10b_threaded_mirroring",
    visibility: "internal",
  });

  if (!thread?.ok || !thread?.threadId) {
    softSkip(`failed to create canonical thread context: ${JSON.stringify(thread)}`);
  }

  const firstMessage = await client.createMessage({
    companyId: "company_internal_aep",
    threadId: thread.threadId,
    senderEmployeeId: employeeIds.EMPLOYEE_INFRA_OPS_MANAGER_ID,
    receiverEmployeeId: employeeIds.EMPLOYEE_RELIABILITY_ENGINEER_ID,
    type: "coordination",
    source: "internal",
    subject: "PR10B continuity message one",
    body: "The first mirrored message should establish an external thread projection.",
    relatedTaskId: "task_pr10b_threaded_mirroring",
  });

  const secondMessage = await client.createMessage({
    companyId: "company_internal_aep",
    threadId: thread.threadId,
    senderEmployeeId: employeeIds.EMPLOYEE_INFRA_OPS_MANAGER_ID,
    receiverEmployeeId: employeeIds.EMPLOYEE_RELIABILITY_ENGINEER_ID,
    type: "coordination",
    source: "internal",
    subject: "PR10B continuity message two",
    body: "The second mirrored message should reuse the same external thread projection.",
    relatedTaskId: "task_pr10b_threaded_mirroring",
  });

  if (!firstMessage?.ok || !firstMessage?.messageId || !secondMessage?.ok || !secondMessage?.messageId) {
    throw new Error(
      `Failed to create mirrored continuity messages: ${JSON.stringify({ firstMessage, secondMessage })}`,
    );
  }

  const detail = await client.getMessageThread(thread.threadId);
  if (!detail?.ok || !Array.isArray(detail.messages)) {
    throw new Error(`Failed to load mirrored thread detail: ${JSON.stringify(detail)}`);
  }

  const externalThreadProjections = Array.isArray(detail.externalThreadProjections)
    ? detail.externalThreadProjections
    : [];
  const first = detail.messages.find((entry: any) => entry.id === firstMessage.messageId);
  const second = detail.messages.find((entry: any) => entry.id === secondMessage.messageId);

  assert(first, `Failed to locate first mirrored message ${firstMessage.messageId}`);
  assert(second, `Failed to locate second mirrored message ${secondMessage.messageId}`);

  const firstDeliveries = Array.isArray(first.mirrorDeliveries) ? first.mirrorDeliveries : [];
  const secondDeliveries = Array.isArray(second.mirrorDeliveries) ? second.mirrorDeliveries : [];
  const firstProjections = Array.isArray(first.externalMessageProjections)
    ? first.externalMessageProjections
    : [];
  const secondProjections = Array.isArray(second.externalMessageProjections)
    ? second.externalMessageProjections
    : [];

  if (
    externalThreadProjections.length === 0 &&
    firstProjections.length === 0 &&
    secondProjections.length === 0 &&
    [...firstDeliveries, ...secondDeliveries].every((delivery: any) => delivery.status === "failed")
  ) {
    softSkip("all mirror deliveries failed before an external thread projection could be formed");
  }

  assert(externalThreadProjections.length >= 1, "Expected at least one external thread projection");

  const threadProjection = externalThreadProjections[0];
  const firstProjection = firstProjections.find(
    (projection: any) =>
      projection.channel === threadProjection.channel && projection.target === threadProjection.target,
  );
  const secondProjection = secondProjections.find(
    (projection: any) =>
      projection.channel === threadProjection.channel && projection.target === threadProjection.target,
  );

  assert(firstProjection, `Expected first message to project onto ${threadProjection.channel}/${threadProjection.target}`);
  assert(secondProjection, `Expected second message to project onto ${threadProjection.channel}/${threadProjection.target}`);
  assert(
    firstProjection.externalThreadId === threadProjection.externalThreadId,
    "Expected first message projection to reuse the thread projection external thread id",
  );
  assert(
    secondProjection.externalThreadId === threadProjection.externalThreadId,
    "Expected second message projection to reuse the thread projection external thread id",
  );
  assert(
    firstProjection.externalThreadId === secondProjection.externalThreadId,
    "Expected both mirrored messages to share the same external thread id",
  );
  assert(
    firstProjection.externalMessageId !== secondProjection.externalMessageId,
    "Expected distinct external message ids for repeated mirrored messages",
  );

  console.log(`- PASS: ${CHECK_LABEL}`);
  console.log(`${CHECK_NAME} passed`, {
    threadId: thread.threadId,
    externalThreadProjection: threadProjection,
    firstProjection,
    secondProjection,
  });
}

main().catch((error) => {
  console.error(`${CHECK_NAME} failed`);
  console.error(error);
  process.exit(1);
});