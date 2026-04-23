/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveServiceBaseUrl } from "../../../lib/service-map";
import { resolveEmployeeIdsByKey } from "../../lib/employee-resolution";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";
import { newToken } from "@aep/shared/index";

export {};

const CHECK_NAME = "inbound-reply-ingestion-check";
const CHECK_LABEL = "inbound reply ingestion check";

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
  } catch (error) {
    if (handleOperatorAgentSoftSkip(CHECK_NAME, error)) {
      process.exit(0);
    }
    throw error;
  }

  const thread = await client.createMessageThread({
    companyId: "company_internal_aep",
    topic: "PR10C inbound reply ingestion check",
    createdByEmployeeId: infraOpsManagerEmployeeId,
    relatedTaskId: "task_pr10c_inbound_ingestion",
    visibility: "internal",
  });

  if (!thread?.ok || !thread?.threadId) {
    softSkip(`failed to create canonical thread context: ${JSON.stringify(thread)}`);
  }

  const outbound = await client.createMessage({
    companyId: "company_internal_aep",
    threadId: thread.threadId,
    senderEmployeeId: infraOpsManagerEmployeeId,
    receiverEmployeeId: reliabilityEngineerEmployeeId,
    type: "coordination",
    source: "internal",
    subject: "PR10C outbound anchor",
    body: "This outbound mirrored message should create an external thread anchor for inbound replies.",
    relatedTaskId: "task_pr10c_inbound_ingestion",
  });

  if (!outbound?.ok || !outbound?.messageId) {
    throw new Error(`Failed to create outbound mirrored message: ${JSON.stringify(outbound)}`);
  }

  const projectedThread = await client.getMessageThread(thread.threadId);
  if (!projectedThread?.ok || !Array.isArray(projectedThread.messages)) {
    throw new Error(`Failed to load projected thread detail: ${JSON.stringify(projectedThread)}`);
  }

  const externalThreadProjections = Array.isArray(projectedThread.externalThreadProjections)
    ? projectedThread.externalThreadProjections
    : [];
  const outboundMessage = projectedThread.messages.find((entry: any) => entry.id === outbound.messageId);
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

  assert(externalThreadProjections.length >= 1, "Expected at least one external thread projection");
  const projection = externalThreadProjections[0];

  const inbound = await client.ingestExternalMessage({
    channel: projection.channel,
    externalThreadId: projection.externalThreadId,
    externalMessageId: `pr10c-inbound-reply-${newToken()}`,
    externalAuthorId: "U_PR10C_REPLY",
    externalReceivedAt: new Date().toISOString(),
    subject: "Inbound Slack reply",
    body: "This reply should be ingested back into the canonical AEP thread.",
    target: projection.target,
  });

  if (!inbound?.ok || !inbound?.messageId) {
    throw new Error(`Failed to ingest inbound external reply: ${JSON.stringify(inbound)}`);
  }

  const detail = await client.getMessageThread(thread.threadId);
  if (!detail?.ok || !Array.isArray(detail.messages)) {
    throw new Error(`Failed to reload thread after inbound ingestion: ${JSON.stringify(detail)}`);
  }

  const ingestedMessage = detail.messages.find((entry: any) => entry.id === inbound.messageId);
  assert(ingestedMessage, `Expected inbound message ${inbound.messageId} to appear on the canonical thread`);
  assert(ingestedMessage.threadId === thread.threadId, `Expected inbound message to stay on thread ${thread.threadId}`);
  assert(
    ingestedMessage.source === projection.channel,
    `Expected inbound source ${projection.channel}, got ${JSON.stringify(ingestedMessage)}`,
  );
  assert(
    ingestedMessage.externalMessageId?.startsWith("pr10c-inbound-reply-"),
    `Expected inbound external message id to be preserved, got ${JSON.stringify(ingestedMessage)}`,
  );

  console.log(`- PASS: ${CHECK_LABEL}`);
  console.log(`${CHECK_NAME} passed`, {
    threadId: thread.threadId,
    projection,
    ingestedMessage,
  });
}

main().catch((error) => {
  console.error(`${CHECK_NAME} failed`);
  console.error(error);
  process.exit(1);
});