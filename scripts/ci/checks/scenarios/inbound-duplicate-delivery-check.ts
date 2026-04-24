/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveServiceBaseUrl } from "../../../lib/service-map";
import { resolveEmployeeIdsByKey } from "../../lib/employee-resolution";
import { hasOnlyNonDeliveredMirrorOutcomes } from "../../shared/operator-agent-check-helpers";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";
import { newToken } from "@aep/shared";

export {};

const CHECK_NAME = "inbound-duplicate-delivery-check";
const CHECK_LABEL = "inbound duplicate delivery check";

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
    topic: "PR10C inbound duplicate delivery check",
    createdByEmployeeId: infraOpsManagerEmployeeId,
    relatedTaskId: "task_pr10c_inbound_duplicate",
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
    subject: "PR10C duplicate anchor",
    body: "This mirrored message should create an external thread projection for duplicate inbound delivery checks.",
    relatedTaskId: "task_pr10c_inbound_duplicate",
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
    hasOnlyNonDeliveredMirrorOutcomes(outboundDeliveries)
  ) {
    softSkip("no external thread projection was formed because outbound mirror delivery was non-delivered");
  }

  assert(externalThreadProjections.length >= 1, "Expected at least one external thread projection");
  const projection = externalThreadProjections[0];

  const inboundPayload = {
    channel: projection.channel,
    externalThreadId: projection.externalThreadId,
    externalMessageId: `pr10c-inbound-duplicate-${newToken()}`,
    externalAuthorId: "U_PR10C_DUPLICATE",
    externalReceivedAt: new Date().toISOString(),
    subject: "Inbound duplicate reply",
    body: "This external reply should only create one canonical message, even if delivered twice.",
    target: projection.target,
  } as const;

  const first = await client.ingestExternalMessage(inboundPayload);
  const second = await client.ingestExternalMessage(inboundPayload);

  assert(first.messageId === second.messageId, `Expected duplicate inbound delivery to return the same message id, got ${JSON.stringify({ first, second })}`);

  const detail = await client.getMessageThread(thread.threadId);
  if (!detail?.ok || !Array.isArray(detail.messages)) {
    throw new Error(`Failed to reload thread after duplicate inbound ingestion: ${JSON.stringify(detail)}`);
  }

  const matchingMessages = detail.messages.filter(
    (entry: any) => entry.externalMessageId === inboundPayload.externalMessageId,
  );

  assert(matchingMessages.length === 1, `Expected exactly one canonical message for duplicate inbound delivery, got ${JSON.stringify(matchingMessages)}`);

  console.log(`- PASS: ${CHECK_LABEL}`);
  console.log(`${CHECK_NAME} passed`, {
    threadId: thread.threadId,
    projection,
    messageId: first.messageId,
  });
}

main().catch((error) => {
  console.error(`${CHECK_NAME} failed`);
  console.error(error);
  process.exit(1);
});