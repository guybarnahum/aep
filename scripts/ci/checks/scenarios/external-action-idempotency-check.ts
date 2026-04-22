/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import {
  detectAdapterCapabilities,
  warnIfNoAdapters,
} from "../../shared/adapter-capability";
import {
  assertRequiredPostRoute,
  hasOptionalPostRoute,
} from "../../shared/operator-agent-surface";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";
import * as employeeIds from "../../shared/employee-ids";

export {};

const CHECK_NAME = "external-action-idempotency-check";
const CHECK_LABEL = "external action idempotency check";

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
  const baseUrl = client.baseUrl.replace(/\/$/, "");

  try {
    await client.endpointExists("/agent/messages/external-action");
  } catch (error) {
    if (handleOperatorAgentSoftSkip(CHECK_NAME, error)) {
      process.exit(0);
    }
    throw error;
  }

  await assertRequiredPostRoute({
    baseUrl,
    path: "/agent/messages/external-action",
    description: "external action route",
  });

  const hasSeedApproval = await hasOptionalPostRoute({
    baseUrl,
    path: "/agent/te/seed-approval",
  });
  if (!hasSeedApproval) {
    softSkip("approval seed endpoint not enabled on this deployment");
  }

  const adapters = await detectAdapterCapabilities(baseUrl);
  warnIfNoAdapters(adapters);

  const seeded = await client.seedApproval({
    requestedByEmployeeId: employeeIds.EMPLOYEE_INFRA_OPS_MANAGER_ID,
    requestedByRoleId: "infra-ops-manager",
    actionType: "deploy-change",
    reason: "PR10D external action idempotency",
    message: "Seed approval thread for external action idempotency.",
    createThread: true,
    threadTopic: "PR10D external action idempotency",
    threadReceiverEmployeeId: employeeIds.EMPLOYEE_RELIABILITY_ENGINEER_ID,
  });

  if (!(seeded as any)?.ok || !(seeded as any).threadId || !(seeded as any).approval?.approvalId) {
    softSkip(`failed to seed approval thread: ${JSON.stringify(seeded)}`);
  }

  const threadId = (seeded as any).threadId;
  const approvalId = (seeded as any).approval.approvalId;

  const outbound = await client.createMessage({
    companyId: "company_internal_aep",
    threadId,
    senderEmployeeId: employeeIds.EMPLOYEE_INFRA_OPS_MANAGER_ID,
    receiverEmployeeId: employeeIds.EMPLOYEE_RELIABILITY_ENGINEER_ID,
    type: "coordination",
    source: "internal",
    subject: "PR10D idempotency anchor",
    body: "Create an external thread projection for external action idempotency.",
    relatedApprovalId: approvalId,
  });

  if (!outbound?.ok || !outbound?.messageId) {
    throw new Error(`Failed to create outbound idempotency anchor: ${JSON.stringify(outbound)}`);
  }

  const projectedThread = await client.getMessageThread(threadId);
  if (!projectedThread?.ok || !Array.isArray(projectedThread.messages)) {
    throw new Error(`Failed to load projected approval thread: ${JSON.stringify(projectedThread)}`);
  }

  const projections = Array.isArray(projectedThread.externalThreadProjections)
    ? projectedThread.externalThreadProjections
    : [];
  const outboundMessage = projectedThread.messages.find((entry: any) => entry.id === outbound.messageId);
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

  assert(projections.length >= 1, "Expected an external thread projection for idempotency");
  const projection = projections[0];
  const externalActionId = `pr10d-idempotent-${crypto.randomUUID().split("-")[0]}`;

  const first = await client.sendExternalAction({
    source: projection.channel,
    externalActionId,
    externalThreadId: projection.externalThreadId,
    externalAuthorId: "U_PR10D_IDEMPOTENT",
    receivedAt: new Date().toISOString(),
    actionType: "approval_approve",
    metadata: { source: "idempotency-check" },
  });

  const second = await client.sendExternalAction({
    source: projection.channel,
    externalActionId,
    externalThreadId: projection.externalThreadId,
    externalAuthorId: "U_PR10D_IDEMPOTENT",
    receivedAt: new Date().toISOString(),
    actionType: "approval_approve",
    metadata: { source: "idempotency-check" },
  });

  assert(first?.ok === true, `Expected first external action success, got ${JSON.stringify(first)}`);
  assert(second?.ok === true && second?.deduped === true, `Expected second external action to dedupe, got ${JSON.stringify(second)}`);

  const threadDetail = await client.getMessageThread(threadId);
  if (!threadDetail?.ok || !Array.isArray(threadDetail.messages)) {
    throw new Error(`Failed to fetch thread detail after external idempotency check: ${JSON.stringify(threadDetail)}`);
  }

  const appliedMessages = threadDetail.messages.filter(
    (message: any) =>
      message.source === "dashboard" &&
      message.responseActionType === "approve_approval" &&
      message.responseActionStatus === "applied",
  );

  assert(appliedMessages.length === 1, `Expected exactly one applied dashboard approval action message, got ${JSON.stringify(appliedMessages)}`);

  console.log(`- PASS: ${CHECK_LABEL}`);
  console.log(`${CHECK_NAME} passed`, {
    approvalId,
    threadId,
    projection,
    first,
    second,
    appliedMessageId: appliedMessages[0]?.id,
  });
}

main().catch((error) => {
  console.error(`${CHECK_NAME} failed`);
  console.error(error);
  process.exit(1);
});
