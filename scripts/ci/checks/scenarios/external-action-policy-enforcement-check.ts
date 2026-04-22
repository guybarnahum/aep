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

const CHECK_NAME = "external-action-policy-enforcement-check";
const CHECK_LABEL = "external action policy enforcement check";

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
    reason: "PR10E external action policy enforcement",
    message: "Seed approval for PR10E action policy enforcement.",
  });

  if (!(seeded as any)?.ok || !(seeded as any).approval?.approvalId) {
    softSkip(`failed to seed approval for action policy enforcement: ${JSON.stringify(seeded)}`);
  }

  const approvalId = (seeded as any).approval.approvalId;
  const thread = await client.createMessageThread({
    companyId: "company_internal_aep",
    topic: "PR10E external action policy enforcement",
    createdByEmployeeId: employeeIds.EMPLOYEE_INFRA_OPS_MANAGER_ID,
    relatedApprovalId: approvalId,
    visibility: "internal",
    externalInteractionPolicy: {
      inboundRepliesAllowed: true,
      externalActionsAllowed: true,
      allowedChannels: ["slack"],
      allowedTargets: ["aep-agent-approvals"],
      allowedExternalActors: ["U_ALLOWED"],
    },
  });

  if (!thread?.ok || !thread?.threadId) {
    softSkip(`failed to create external action policy thread: ${JSON.stringify(thread)}`);
  }

  const outbound = await client.createMessage({
    companyId: "company_internal_aep",
    threadId: thread.threadId,
    senderEmployeeId: employeeIds.EMPLOYEE_INFRA_OPS_MANAGER_ID,
    receiverEmployeeId: employeeIds.EMPLOYEE_RELIABILITY_ENGINEER_ID,
    type: "coordination",
    source: "internal",
    subject: "PR10E action policy anchor",
    body: "Create a projected approval thread so external policy can be enforced.",
    relatedApprovalId: approvalId,
  });

  if (!outbound?.ok || !outbound?.messageId) {
    throw new Error(`Failed to create action policy anchor message: ${JSON.stringify(outbound)}`);
  }

  const projected = await client.getMessageThread(thread.threadId);
  if (!projected?.ok || !Array.isArray(projected.messages)) {
    throw new Error(`Failed to load projected action policy thread: ${JSON.stringify(projected)}`);
  }

  const projections = Array.isArray(projected.externalThreadProjections)
    ? projected.externalThreadProjections
    : [];
  const outboundMessage = projected.messages.find((entry: any) => entry.id === outbound.messageId);
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

  assert(projections.length >= 1, "Expected external thread projection for action policy enforcement");
  const projection = projections[0];

  const deniedResponse = await fetch(`${baseUrl}/agent/messages/external-action`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      source: projection.channel,
      externalActionId: `pr10e-action-denied-${crypto.randomUUID().split("-")[0]}`,
      externalThreadId: projection.externalThreadId,
      externalAuthorId: "U_BLOCKED",
      receivedAt: new Date().toISOString(),
      actionType: "approval_approve",
    }),
  });

  assert(deniedResponse.status === 403, `Expected blocked external action to return 403, got ${deniedResponse.status}`);
  const deniedBody = (await deniedResponse.json()) as { error?: string };
  assert(deniedBody.error === "external_actor_not_allowed", `Expected external_actor_not_allowed, got ${JSON.stringify(deniedBody)}`);

  const approvalAfterDenied = await client.getApproval(approvalId);
  assert((approvalAfterDenied as any)?.approval?.status === "pending", `Expected approval to remain pending, got ${JSON.stringify(approvalAfterDenied)}`);

  const threadAfterDenied = await client.getMessageThread(thread.threadId);
  const deniedAppliedMessages = Array.isArray(threadAfterDenied?.messages)
    ? threadAfterDenied.messages.filter(
      (message: any) =>
        message.source === "dashboard" &&
        message.responseActionType === "approve_approval" &&
        message.responseActionStatus === "applied",
    )
    : [];

  assert(deniedAppliedMessages.length === 0, `Expected no applied dashboard action message after denied action, got ${JSON.stringify(threadAfterDenied)}`);

  const allowed = await client.sendExternalAction({
    source: projection.channel,
    externalActionId: `pr10e-action-allowed-${crypto.randomUUID().split("-")[0]}`,
    externalThreadId: projection.externalThreadId,
    externalAuthorId: "U_ALLOWED",
    receivedAt: new Date().toISOString(),
    actionType: "approval_approve",
  });

  assert(allowed?.ok === true, `Expected allowed external action success, got ${JSON.stringify(allowed)}`);

  const approvalAfterAllowed = await client.getApproval(approvalId);
  assert((approvalAfterAllowed as any)?.approval?.status === "approved", `Expected approval to become approved, got ${JSON.stringify(approvalAfterAllowed)}`);

  const finalDetail = await client.getMessageThread(thread.threadId);
  const audit = Array.isArray(finalDetail?.externalInteractionAudit)
    ? finalDetail.externalInteractionAudit
    : [];
  const appliedMessages = Array.isArray(finalDetail?.messages)
    ? finalDetail.messages.filter(
      (message: any) =>
        message.source === "dashboard" &&
        message.responseActionType === "approve_approval" &&
        message.responseActionStatus === "applied",
    )
    : [];
  const systemMessages = Array.isArray(finalDetail?.messages)
    ? finalDetail.messages.filter(
      (message: any) => message.source === "system" && message.subject === "Approval approved",
    )
    : [];

  assert(appliedMessages.length >= 1, `Expected applied dashboard action history, got ${JSON.stringify(finalDetail)}`);
  assert(systemMessages.length >= 1, `Expected system approval history, got ${JSON.stringify(finalDetail)}`);
  assert(
    audit.some((entry: any) => entry.interactionKind === "action" && entry.decision === "denied"),
    `Expected denied action audit row, got ${JSON.stringify(audit)}`,
  );
  assert(
    audit.some((entry: any) => entry.interactionKind === "action" && entry.decision === "allowed"),
    `Expected allowed action audit row, got ${JSON.stringify(audit)}`,
  );

  console.log(`- PASS: ${CHECK_LABEL}`);
  console.log(`${CHECK_NAME} passed`, {
    approvalId,
    threadId: thread.threadId,
    projection,
  });
}

main().catch((error) => {
  console.error(`${CHECK_NAME} failed`);
  console.error(error);
  process.exit(1);
});