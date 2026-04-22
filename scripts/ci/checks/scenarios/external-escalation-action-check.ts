/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveServiceBaseUrl } from "../../../lib/service-map";
import { resolveEmployeeIdsByKey } from "../../lib/employee-resolution";
import {
  detectAdapterCapabilities,
  warnIfNoAdapters,
} from "../../shared/adapter-capability";
import { assertRequiredPostRoute } from "../../shared/operator-agent-surface";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

const CHECK_NAME = "external-escalation-action-check";
const CHECK_LABEL = "external escalation action check";

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

  const adapters = await detectAdapterCapabilities(baseUrl);
  warnIfNoAdapters(adapters);

  const escalations = await client.listEscalations({ limit: 20 });
  const entries = Array.isArray((escalations as any)?.entries)
    ? (escalations as any).entries
    : Array.isArray((escalations as any)?.escalations)
      ? (escalations as any).escalations
      : [];
  const openEscalation = entries.find((entry: any) => entry.state === "open");

  if (!openEscalation) {
    softSkip("no open escalations available");
  }

  const escalationId = openEscalation.escalationId ?? openEscalation.id;
  const acknowledged = await client.acknowledgeEscalation({
    escalationId,
    actor: "scenario_operator",
  });

  if (!(acknowledged as any)?.ok) {
    throw new Error(`Failed to acknowledge escalation before external action: ${JSON.stringify(acknowledged)}`);
  }

  const detailAfterAck = await client.getEscalation(escalationId);
  const threadId = (detailAfterAck as any)?.thread?.id;
  if (!threadId) {
    throw new Error(`Expected escalation thread after acknowledgement: ${JSON.stringify(detailAfterAck)}`);
  }

  const outbound = await client.createMessage({
    companyId: "company_internal_aep",
    threadId,
    senderEmployeeId: infraOpsManagerEmployeeId,
    receiverEmployeeId: reliabilityEngineerEmployeeId,
    type: "escalation",
    source: "internal",
    subject: "PR10D escalation anchor",
    body: "Create an external thread projection for escalation actions.",
    relatedEscalationId: escalationId,
  });

  if (!outbound?.ok || !outbound?.messageId) {
    throw new Error(`Failed to create outbound escalation anchor: ${JSON.stringify(outbound)}`);
  }

  const projectedThread = await client.getMessageThread(threadId);
  if (!projectedThread?.ok || !Array.isArray(projectedThread.messages)) {
    throw new Error(`Failed to load projected escalation thread: ${JSON.stringify(projectedThread)}`);
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

  assert(projections.length >= 1, "Expected an external thread projection for escalation action");
  const projection = projections[0];

  const action = await client.sendExternalAction({
    source: projection.channel,
    externalActionId: `pr10d-escalation-${crypto.randomUUID().split("-")[0]}`,
    externalThreadId: projection.externalThreadId,
    externalAuthorId: "U_PR10D_ESCALATION",
    receivedAt: new Date().toISOString(),
    actionType: "escalation_resolve",
    metadata: { source: "scenario-check" },
  });

  assert(action?.ok === true, `Expected external escalation action success, got ${JSON.stringify(action)}`);
  assert(action?.threadId === threadId, `Expected threadId ${threadId}, got ${JSON.stringify(action)}`);

  const escalationDetail = await client.getEscalation(escalationId);
  if (!(escalationDetail as any)?.ok || !(escalationDetail as any).escalation) {
    throw new Error(`Failed to fetch escalation detail after external action: ${JSON.stringify(escalationDetail)}`);
  }

  const state = (escalationDetail as any).escalation.state;
  assert(state === "resolved", `Expected escalation to be resolved, got ${JSON.stringify(escalationDetail)}`);

  const threadDetail = await client.getMessageThread(threadId);
  if (!threadDetail?.ok || !Array.isArray(threadDetail.messages)) {
    throw new Error(`Failed to fetch thread detail after external escalation action: ${JSON.stringify(threadDetail)}`);
  }

  const hasActionMessage = threadDetail.messages.some(
    (message: any) =>
      message.source === "dashboard" &&
      message.responseActionType === "resolve_escalation" &&
      message.responseActionStatus === "applied" &&
      message.causedStateTransition === true,
  );

  assert(hasActionMessage, `Expected dashboard escalation action message in thread history, got ${JSON.stringify(threadDetail.messages)}`);

  console.log(`- PASS: ${CHECK_LABEL}`);
  console.log(`${CHECK_NAME} passed`, {
    escalationId,
    threadId,
    projection,
  });
}

main().catch((error) => {
  console.error(`${CHECK_NAME} failed`);
  console.error(error);
  process.exit(1);
});
