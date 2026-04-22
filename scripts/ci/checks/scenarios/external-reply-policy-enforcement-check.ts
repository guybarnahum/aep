/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveEmployeeIdsByKey } from "../../lib/employee-resolution";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";
import { resolveServiceBaseUrl } from "../../../lib/service-map";

export {};

const CHECK_NAME = "external-reply-policy-enforcement-check";
const CHECK_LABEL = "external reply policy enforcement check";

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
  const agentBaseUrl = resolveServiceBaseUrl({
    envVar: "OPERATOR_AGENT_BASE_URL",
    serviceName: "operator-agent",
  });

  try {
    await client.endpointExists("/agent/messages/inbound");
  } catch (error) {
    if (handleOperatorAgentSoftSkip(CHECK_NAME, error)) {
      process.exit(0);
    }
    throw error;
  }

  const liveEmployeeIds = await resolveEmployeeIdsByKey({
    agentBaseUrl,
    employees: [
      {
        key: "manager",
        roleId: "infra-ops-manager",
        teamId: "team_infra",
        runtimeStatus: "implemented",
      },
      {
        key: "reliabilityEngineer",
        roleId: "reliability-engineer",
        teamId: "team_validation",
      },
    ],
  });
  const managerEmployeeId = liveEmployeeIds.manager;
  const reliabilityEngineerEmployeeId = liveEmployeeIds.reliabilityEngineer;

  const thread = await client.createMessageThread({
    companyId: "company_internal_aep",
    topic: "PR10E external reply policy enforcement",
    createdByEmployeeId: managerEmployeeId,
    relatedTaskId: "task_pr10e_reply_policy",
    visibility: "internal",
    externalInteractionPolicy: {
      inboundRepliesAllowed: true,
      externalActionsAllowed: false,
      allowedChannels: ["slack"],
      allowedTargets: ["aep-agent-feed"],
      allowedExternalActors: ["U_ALLOWED"],
    },
  });

  if (!thread?.ok || !thread?.threadId) {
    softSkip(`failed to create reply policy thread: ${JSON.stringify(thread)}`);
  }

  const outbound = await client.createMessage({
    companyId: "company_internal_aep",
    threadId: thread.threadId,
    senderEmployeeId: managerEmployeeId,
    receiverEmployeeId: reliabilityEngineerEmployeeId,
    type: "coordination",
    source: "internal",
    subject: "PR10E reply policy anchor",
    body: "Create a projected thread so reply policy can be enforced.",
    relatedTaskId: "task_pr10e_reply_policy",
  });

  if (!outbound?.ok || !outbound?.messageId) {
    throw new Error(`Failed to create reply policy anchor message: ${JSON.stringify(outbound)}`);
  }

  const projected = await client.getMessageThread(thread.threadId);
  if (!projected?.ok || !Array.isArray(projected.messages)) {
    throw new Error(`Failed to load projected thread detail: ${JSON.stringify(projected)}`);
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

  assert(projections.length >= 1, "Expected external thread projection for reply policy enforcement");
  const projection = projections[0];
  const initialMessageCount = projected.messages.length;

  const deniedResponse = await fetch(`${client.baseUrl.replace(/\/$/, "")}/agent/messages/inbound`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      channel: projection.channel,
      externalThreadId: projection.externalThreadId,
      externalMessageId: `pr10e-reply-denied-${crypto.randomUUID().split("-")[0]}`,
      externalAuthorId: "U_BLOCKED",
      externalReceivedAt: new Date().toISOString(),
      subject: "Denied reply",
      body: "This reply should be denied.",
      target: projection.target,
    }),
  });

  assert(deniedResponse.status === 403, `Expected denied reply to return 403, got ${deniedResponse.status}`);
  const deniedBody = (await deniedResponse.json()) as { error?: string };
  assert(deniedBody.error === "external_actor_not_allowed", `Expected external_actor_not_allowed, got ${JSON.stringify(deniedBody)}`);

  const afterDenied = await client.getMessageThread(thread.threadId);
  assert(afterDenied?.messages?.length === initialMessageCount, `Expected denied reply not to create canonical message, got ${JSON.stringify(afterDenied)}`);

  const allowed = await client.ingestExternalMessage({
    channel: projection.channel,
    externalThreadId: projection.externalThreadId,
    externalMessageId: `pr10e-reply-allowed-${crypto.randomUUID().split("-")[0]}`,
    externalAuthorId: "U_ALLOWED",
    externalReceivedAt: new Date().toISOString(),
    subject: "Allowed reply",
    body: "This reply should be accepted.",
    target: projection.target,
  });

  assert(allowed?.ok === true && allowed?.messageId, `Expected allowed reply success, got ${JSON.stringify(allowed)}`);

  const finalDetail = await client.getMessageThread(thread.threadId);
  const replyAudit = Array.isArray(finalDetail?.externalInteractionAudit)
    ? finalDetail.externalInteractionAudit
    : [];

  assert(
    finalDetail?.messages?.some((entry: any) => entry.id === allowed.messageId),
    `Expected allowed reply message to exist on thread, got ${JSON.stringify(finalDetail)}`,
  );
  assert(
    replyAudit.some((entry: any) => entry.interactionKind === "reply" && entry.decision === "denied"),
    `Expected denied reply audit row, got ${JSON.stringify(replyAudit)}`,
  );
  assert(
    replyAudit.some((entry: any) => entry.interactionKind === "reply" && entry.decision === "allowed"),
    `Expected allowed reply audit row, got ${JSON.stringify(replyAudit)}`,
  );

  console.log(`- PASS: ${CHECK_LABEL}`);
  console.log(`${CHECK_NAME} passed`, {
    threadId: thread.threadId,
    projection,
    allowedMessageId: allowed.messageId,
  });
}

main().catch((error) => {
  console.error(`${CHECK_NAME} failed`);
  console.error(error);
  process.exit(1);
});