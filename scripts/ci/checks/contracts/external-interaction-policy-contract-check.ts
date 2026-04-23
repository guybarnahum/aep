/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveServiceBaseUrl } from "../../../lib/service-map";
import { resolveEmployeeIdsByKey } from "../../lib/employee-resolution";
import {
  detectAdapterCapabilities,
  warnIfNoAdapters,
} from "../../shared/adapter-capability";
import {
  assertRequiredPostRoute,
  hasOptionalPostRoute,
} from "../../shared/operator-agent-surface";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";
import { newToken } from "@aep/shared/index";

export {};

const CHECK_NAME = "external-interaction-policy-contract-check";
const CHECK_LABEL = "external interaction policy contract check";

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

async function requireProjection(args: {
  client: ReturnType<typeof createOperatorAgentClient>;
  threadId: string;
  messageId: string;
}) {
  const detail = await args.client.getMessageThread(args.threadId);
  if (!detail?.ok || !Array.isArray(detail.messages)) {
    throw new Error(`Failed to load projected thread detail: ${JSON.stringify(detail)}`);
  }

  const projections = Array.isArray(detail.externalThreadProjections)
    ? detail.externalThreadProjections
    : [];
  const outboundMessage = detail.messages.find((entry: any) => entry.id === args.messageId);
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

  assert(projections.length >= 1, `Expected external projection for thread ${args.threadId}`);
  return {
    detail,
    projection: projections[0],
  };
}

async function main(): Promise<void> {
  const client = createOperatorAgentClient();
  const baseUrl = client.baseUrl.replace(/\/$/, "");
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
      {
        key: "reliabilityEngineer",
        roleId: "reliability-engineer",
        teamId: "team_validation",
        runtimeStatus: "implemented",
      },
    ],
  });
  const infraOpsManagerEmployeeId = liveEmployeeIds.infraOpsManager;
  const reliabilityEngineerEmployeeId = liveEmployeeIds.reliabilityEngineer;

  try {
    await client.endpointExists("/agent/messages/inbound");
    await client.endpointExists("/agent/messages/external-action");
  } catch (error) {
    if (handleOperatorAgentSoftSkip(CHECK_NAME, error)) {
      process.exit(0);
    }
    throw error;
  }

  await assertRequiredPostRoute({
    baseUrl,
    path: "/agent/messages/inbound",
    description: "inbound message route",
  });

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

  const invalidPolicyResponse = await fetch(`${baseUrl}/agent/message-threads`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      companyId: "company_internal_aep",
      topic: "PR10E invalid channel policy",
      createdByEmployeeId: infraOpsManagerEmployeeId,
      visibility: "internal",
      externalInteractionPolicy: {
        allowedChannels: ["teams"],
      },
    }),
  });

  assert(invalidPolicyResponse.status === 400, `Expected invalid policy channel list to return 400, got ${invalidPolicyResponse.status}`);

  const replyThread = await client.createMessageThread({
    companyId: "company_internal_aep",
    topic: "PR10E reply policy contract",
    createdByEmployeeId: infraOpsManagerEmployeeId,
    relatedTaskId: "task_pr10e_reply_contract",
    visibility: "internal",
    externalInteractionPolicy: {
      inboundRepliesAllowed: true,
      externalActionsAllowed: false,
      allowedChannels: ["slack"],
      allowedTargets: ["aep-agent-feed"],
      allowedExternalActors: ["U_ALLOWED"],
    },
  });

  if (!replyThread?.ok || !replyThread?.threadId) {
    softSkip(`failed to create reply policy thread: ${JSON.stringify(replyThread)}`);
  }

  const replyAnchor = await client.createMessage({
    companyId: "company_internal_aep",
    threadId: replyThread.threadId,
    senderEmployeeId: infraOpsManagerEmployeeId,
    receiverEmployeeId: reliabilityEngineerEmployeeId,
    type: "coordination",
    source: "internal",
    subject: "PR10E reply contract anchor",
    body: "Create a projected thread so inbound reply policy can be exercised.",
    relatedTaskId: "task_pr10e_reply_contract",
  });

  if (!replyAnchor?.ok || !replyAnchor?.messageId) {
    throw new Error(`Failed to create reply anchor message: ${JSON.stringify(replyAnchor)}`);
  }

  const replyProjectionState = await requireProjection({
    client,
    threadId: replyThread.threadId,
    messageId: replyAnchor.messageId,
  });

  const replyProjection = replyProjectionState.projection;

  const deniedReplyResponse = await fetch(`${baseUrl}/agent/messages/inbound`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      channel: replyProjection.channel,
      externalThreadId: replyProjection.externalThreadId,
      externalMessageId: `pr10e-denied-reply-${newToken()}`,
      externalAuthorId: "U_BLOCKED",
      externalReceivedAt: new Date().toISOString(),
      subject: "Denied reply",
      body: "This reply should be rejected by thread-level external policy.",
      target: replyProjection.target,
    }),
  });

  assert(deniedReplyResponse.status === 403, `Expected denied reply to return 403, got ${deniedReplyResponse.status}`);
  const deniedReplyBody = (await deniedReplyResponse.json()) as { error?: string };
  assert(deniedReplyBody.error === "external_actor_not_allowed", `Expected external_actor_not_allowed, got ${JSON.stringify(deniedReplyBody)}`);

  const allowedReply = await client.ingestExternalMessage({
    channel: replyProjection.channel,
    externalThreadId: replyProjection.externalThreadId,
    externalMessageId: `pr10e-allowed-reply-${newToken()}`,
    externalAuthorId: "U_ALLOWED",
    externalReceivedAt: new Date().toISOString(),
    subject: "Allowed reply",
    body: "This reply should be accepted by thread-level external policy.",
    target: replyProjection.target,
  });

  assert(allowedReply?.ok === true, `Expected allowed reply success, got ${JSON.stringify(allowedReply)}`);

  const replyDetail = await client.getMessageThread(replyThread.threadId);
  const replyAudit = Array.isArray(replyDetail?.externalInteractionAudit)
    ? replyDetail.externalInteractionAudit
    : [];

  assert(replyDetail?.externalInteractionPolicy?.allowedChannels?.includes("slack"), `Expected policy detail on thread response, got ${JSON.stringify(replyDetail)}`);
  assert(
    replyAudit.some((entry: any) => entry.interactionKind === "reply" && entry.decision === "denied" && entry.reasonCode === "external_actor_not_allowed"),
    `Expected denied reply audit row, got ${JSON.stringify(replyAudit)}`,
  );
  assert(
    replyAudit.some((entry: any) => entry.interactionKind === "reply" && entry.decision === "allowed" && entry.reasonCode === "allowed"),
    `Expected allowed reply audit row, got ${JSON.stringify(replyAudit)}`,
  );

  const invalidInboundChannel = await fetch(`${baseUrl}/agent/messages/inbound`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      channel: "teams",
      externalThreadId: replyProjection.externalThreadId,
      externalMessageId: `pr10e-invalid-channel-${newToken()}`,
      externalReceivedAt: new Date().toISOString(),
      body: "invalid",
    }),
  });

  assert(invalidInboundChannel.status === 400, `Expected invalid inbound channel to return 400, got ${invalidInboundChannel.status}`);

  const seededApproval = await client.seedApproval({
    requestedByEmployeeId: infraOpsManagerEmployeeId,
    requestedByRoleId: "infra-ops-manager",
    actionType: "deploy-change",
    reason: "PR10E action policy contract",
    message: "Seed approval for external policy contract validation.",
  });

  if (!(seededApproval as any)?.ok || !(seededApproval as any).approval?.approvalId) {
    softSkip(`failed to seed approval for action contract: ${JSON.stringify(seededApproval)}`);
  }

  const approvalId = (seededApproval as any).approval.approvalId;
  const actionThread = await client.createMessageThread({
    companyId: "company_internal_aep",
    topic: "PR10E action policy contract",
    createdByEmployeeId: infraOpsManagerEmployeeId,
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

  if (!actionThread?.ok || !actionThread?.threadId) {
    softSkip(`failed to create action policy thread: ${JSON.stringify(actionThread)}`);
  }

  const actionAnchor = await client.createMessage({
    companyId: "company_internal_aep",
    threadId: actionThread.threadId,
    senderEmployeeId: infraOpsManagerEmployeeId,
    receiverEmployeeId: reliabilityEngineerEmployeeId,
    type: "coordination",
    source: "internal",
    subject: "PR10E action contract anchor",
    body: "Create a projected thread so external actions can be authorized.",
    relatedApprovalId: approvalId,
  });

  if (!actionAnchor?.ok || !actionAnchor?.messageId) {
    throw new Error(`Failed to create action anchor message: ${JSON.stringify(actionAnchor)}`);
  }

  const actionProjectionState = await requireProjection({
    client,
    threadId: actionThread.threadId,
    messageId: actionAnchor.messageId,
  });

  const actionProjection = actionProjectionState.projection;
  const sharedExternalActionId = `pr10e-shared-action-${newToken()}`;

  const deniedActionResponse = await fetch(`${client.baseUrl.replace(/\/$/, "")}/agent/messages/external-action`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      source: actionProjection.channel,
      externalActionId: sharedExternalActionId,
      externalThreadId: actionProjection.externalThreadId,
      externalAuthorId: "U_BLOCKED",
      receivedAt: new Date().toISOString(),
      actionType: "approval_approve",
    }),
  });

  assert(deniedActionResponse.status === 403, `Expected denied external action to return 403, got ${deniedActionResponse.status}`);
  const deniedActionBody = (await deniedActionResponse.json()) as { error?: string };
  assert(deniedActionBody.error === "external_actor_not_allowed", `Expected external_actor_not_allowed, got ${JSON.stringify(deniedActionBody)}`);

  const approvalAfterDenied = await client.getApproval(approvalId);
  assert((approvalAfterDenied as any)?.approval?.status === "pending", `Expected approval to remain pending after denied external action, got ${JSON.stringify(approvalAfterDenied)}`);

  const allowedAction = await client.sendExternalAction({
    source: actionProjection.channel,
    externalActionId: sharedExternalActionId,
    externalThreadId: actionProjection.externalThreadId,
    externalAuthorId: "U_ALLOWED",
    receivedAt: new Date().toISOString(),
    actionType: "approval_approve",
  });

  assert(allowedAction?.ok === true, `Expected allowed external action to succeed, got ${JSON.stringify(allowedAction)}`);

  const actionDetail = await client.getMessageThread(actionThread.threadId);
  const actionAudit = Array.isArray(actionDetail?.externalInteractionAudit)
    ? actionDetail.externalInteractionAudit
    : [];

  assert(
    actionAudit.some((entry: any) => entry.interactionKind === "action" && entry.decision === "denied" && entry.reasonCode === "external_actor_not_allowed"),
    `Expected denied action audit row, got ${JSON.stringify(actionAudit)}`,
  );
  assert(
    actionAudit.some((entry: any) => entry.interactionKind === "action" && entry.decision === "allowed" && entry.reasonCode === "allowed"),
    `Expected allowed action audit row, got ${JSON.stringify(actionAudit)}`,
  );

  const invalidActionChannel = await fetch(`${client.baseUrl.replace(/\/$/, "")}/agent/messages/external-action`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      source: "teams",
      externalActionId: `pr10e-invalid-action-${newToken()}`,
      externalThreadId: actionProjection.externalThreadId,
      externalAuthorId: "U_ALLOWED",
      receivedAt: new Date().toISOString(),
      actionType: "approval_approve",
    }),
  });

  assert(invalidActionChannel.status === 400, `Expected invalid action channel to return 400, got ${invalidActionChannel.status}`);

  console.log(`- PASS: ${CHECK_LABEL}`);
  console.log(`${CHECK_NAME} passed`, {
    replyThreadId: replyThread.threadId,
    actionThreadId: actionThread.threadId,
    approvalId,
    deniedReplyBody,
    deniedActionBody,
  });
}

main().catch((error) => {
  console.error(`${CHECK_NAME} failed`);
  console.error(error);
  process.exit(1);
});