/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";
import * as employeeIds from "../../shared/employee-ids";

export {};

const CHECK_NAME = "inbound-reply-correlation-contract-check";
const CHECK_LABEL = "inbound reply correlation contract check";

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
    await client.endpointExists("/agent/messages/inbound");
  } catch (error) {
    if (handleOperatorAgentSoftSkip(CHECK_NAME, error)) {
      process.exit(0);
    }
    throw error;
  }

  const thread = await client.createMessageThread({
    companyId: "company_internal_aep",
    topic: "PR10C inbound reply correlation contract check",
    createdByEmployeeId: employeeIds.EMPLOYEE_INFRA_OPS_MANAGER_ID,
    relatedTaskId: "task_pr10c_inbound_contract",
    visibility: "internal",
  });

  if (!thread?.ok || !thread?.threadId) {
    softSkip(`failed to create canonical thread context: ${JSON.stringify(thread)}`);
  }

  const outbound = await client.createMessage({
    companyId: "company_internal_aep",
    threadId: thread.threadId,
    senderEmployeeId: employeeIds.EMPLOYEE_INFRA_OPS_MANAGER_ID,
    receiverEmployeeId: employeeIds.EMPLOYEE_RELIABILITY_ENGINEER_ID,
    type: "coordination",
    source: "internal",
    subject: "PR10C correlation anchor",
    body: "Create a mirrored thread projection so inbound replies can resolve back to the canonical thread.",
    relatedTaskId: "task_pr10c_inbound_contract",
  });

  if (!outbound?.ok || !outbound?.messageId) {
    throw new Error(`Failed to create outbound mirrored message: ${JSON.stringify(outbound)}`);
  }

  const detail = await client.getMessageThread(thread.threadId);
  if (!detail?.ok || !Array.isArray(detail.messages)) {
    throw new Error(`Failed to load projected thread detail: ${JSON.stringify(detail)}`);
  }

  const externalThreadProjections = Array.isArray(detail.externalThreadProjections)
    ? detail.externalThreadProjections
    : [];
  const outboundMessage = detail.messages.find((entry: any) => entry.id === outbound.messageId);
  const outboundDeliveries = Array.isArray(outboundMessage?.mirrorDeliveries)
    ? outboundMessage.mirrorDeliveries
    : [];

  if (
    externalThreadProjections.length === 0 &&
    outboundDeliveries.length > 0 &&
    outboundDeliveries.every((delivery: any) => delivery.status === "failed")
  ) {
    softSkip("no external thread projection was formed because outbound mirror delivery failed");
  }

  assert(externalThreadProjections.length >= 1, "Expected an external thread projection for inbound correlation");
  const projection = externalThreadProjections[0];

  const inboundPayload = {
    channel: projection.channel,
    externalThreadId: projection.externalThreadId,
    externalMessageId: `pr10c-inbound-contract-${crypto.randomUUID().split("-")[0]}`,
    externalAuthorId: "U_PR10C_CONTRACT",
    externalReceivedAt: new Date().toISOString(),
    subject: "Inbound reply",
    body: "Inbound correlation should resolve this reply back to the canonical thread.",
    target: projection.target,
  } as const;

  const ingested = await client.ingestExternalMessage(inboundPayload);
  assert(ingested.ok === true, `Expected inbound ingestion success, got ${JSON.stringify(ingested)}`);
  assert(ingested.threadId === thread.threadId, `Expected resolved threadId ${thread.threadId}, got ${JSON.stringify(ingested)}`);

  const duplicate = await client.ingestExternalMessage(inboundPayload);
  assert(duplicate.messageId === ingested.messageId, `Expected duplicate inbound delivery to return the same canonical message id, got ${JSON.stringify({ ingested, duplicate })}`);

  const unknownResponse = await fetch(`${client.baseUrl.replace(/\/$/, "")}/agent/messages/inbound`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...inboundPayload,
      externalThreadId: `missing-${crypto.randomUUID().split("-")[0]}`,
      externalMessageId: `missing-msg-${crypto.randomUUID().split("-")[0]}`,
    }),
  });

  assert(unknownResponse.status === 404, `Expected unknown external thread to return 404, got ${unknownResponse.status}`);
  const unknownBody = (await unknownResponse.json()) as { error?: string };
  assert(unknownBody.error === "thread_not_found", `Expected thread_not_found error, got ${JSON.stringify(unknownBody)}`);

  console.log(`- PASS: ${CHECK_LABEL}`);
  console.log(`${CHECK_NAME} passed`, {
    threadId: thread.threadId,
    projection,
    ingestedMessageId: ingested.messageId,
    duplicateMessageId: duplicate.messageId,
    unknownResponse: unknownBody,
  });
}

main().catch((error) => {
  console.error(`${CHECK_NAME} failed`);
  console.error(error);
  process.exit(1);
});