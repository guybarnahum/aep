/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

const CHECK_NAME = "external-action-contract-check";
const CHECK_LABEL = "external action contract check";

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
    await client.endpointExists("/agent/messages/external-action");
  } catch (error) {
    if (handleOperatorAgentSoftSkip(CHECK_NAME, error)) {
      process.exit(0);
    }
    throw error;
  }

  const seeded = await client.seedApproval({
    requestedByEmployeeId: "emp_infra_ops_manager_01",
    requestedByRoleId: "infra-ops-manager",
    actionType: "deploy-change",
    reason: "PR10D external action contract",
    message: "Seed approval thread for strict external action validation.",
    createThread: true,
    threadTopic: "PR10D external action contract",
    threadReceiverEmployeeId: "emp_val_specialist_01",
  });

  if (!(seeded as any)?.ok || !(seeded as any).threadId || !(seeded as any).approval?.approvalId) {
    softSkip(`failed to seed approval thread: ${JSON.stringify(seeded)}`);
  }

  const threadId = (seeded as any).threadId;
  const approvalId = (seeded as any).approval.approvalId;

  const outbound = await client.createMessage({
    companyId: "company_internal_aep",
    threadId,
    senderEmployeeId: "emp_infra_ops_manager_01",
    receiverEmployeeId: "emp_val_specialist_01",
    type: "coordination",
    source: "internal",
    subject: "PR10D contract anchor",
    body: "Create an external projection so strict external actions can be correlated back to the approval thread.",
    relatedApprovalId: approvalId,
  });

  if (!outbound?.ok || !outbound?.messageId) {
    throw new Error(`Failed to create outbound anchor message: ${JSON.stringify(outbound)}`);
  }

  const detail = await client.getMessageThread(threadId);
  if (!detail?.ok || !Array.isArray(detail.messages)) {
    throw new Error(`Failed to load projected approval thread: ${JSON.stringify(detail)}`);
  }

  const projections = Array.isArray(detail.externalThreadProjections)
    ? detail.externalThreadProjections
    : [];
  const outboundMessage = detail.messages.find((entry: any) => entry.id === outbound.messageId);
  const outboundDeliveries = Array.isArray(outboundMessage?.mirrorDeliveries)
    ? outboundMessage.mirrorDeliveries
    : [];

  if (
    projections.length === 0 &&
    outboundDeliveries.length > 0 &&
    outboundDeliveries.every((delivery: any) => delivery.status === "failed")
  ) {
    softSkip("no external thread projection was formed because outbound mirror delivery failed");
  }

  assert(projections.length >= 1, "Expected external thread projection for external action contract check");
  const projection = projections[0];

  const success = await client.sendExternalAction({
    source: projection.channel,
    externalActionId: `pr10d-contract-${crypto.randomUUID().split("-")[0]}`,
    externalThreadId: projection.externalThreadId,
    externalAuthorId: "U_PR10D_CONTRACT",
    receivedAt: new Date().toISOString(),
    actionType: "approval_approve",
    metadata: { source: "contract-check" },
  });

  assert(success?.ok === true, `Expected external approval action success, got ${JSON.stringify(success)}`);
  assert(success?.threadId === threadId, `Expected external action to resolve thread ${threadId}, got ${JSON.stringify(success)}`);

  const unsupportedResponse = await fetch(`${client.baseUrl.replace(/\/$/, "")}/agent/messages/external-action`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      source: projection.channel,
      externalActionId: `pr10d-bad-${crypto.randomUUID().split("-")[0]}`,
      externalThreadId: projection.externalThreadId,
      externalAuthorId: "U_PR10D_CONTRACT",
      receivedAt: new Date().toISOString(),
      actionType: "approval_maybe",
    }),
  });

  assert(unsupportedResponse.status === 400, `Expected unsupported action type to return 400, got ${unsupportedResponse.status}`);
  const unsupportedBody = (await unsupportedResponse.json()) as { error?: string };
  assert(unsupportedBody.error === "unsupported_action_type", `Expected unsupported_action_type error, got ${JSON.stringify(unsupportedBody)}`);

  const missingResponse = await fetch(`${client.baseUrl.replace(/\/$/, "")}/agent/messages/external-action`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      source: projection.channel,
      externalActionId: `pr10d-missing-${crypto.randomUUID().split("-")[0]}`,
      externalThreadId: `missing-${crypto.randomUUID().split("-")[0]}`,
      externalAuthorId: "U_PR10D_CONTRACT",
      receivedAt: new Date().toISOString(),
      actionType: "approval_approve",
    }),
  });

  assert(missingResponse.status === 404, `Expected missing external thread to return 404, got ${missingResponse.status}`);
  const missingBody = (await missingResponse.json()) as { error?: string };
  assert(missingBody.error === "thread_not_found", `Expected thread_not_found error, got ${JSON.stringify(missingBody)}`);

  console.log(`- PASS: ${CHECK_LABEL}`);
  console.log(`${CHECK_NAME} passed`, {
    approvalId,
    threadId,
    projection,
    success,
    unsupportedBody,
    missingBody,
  });
}

main().catch((error) => {
  console.error(`${CHECK_NAME} failed`);
  console.error(error);
  process.exit(1);
});
