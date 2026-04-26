/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveServiceBaseUrl } from "../../../lib/service-map";
import { resolveEmployeeIdsByKey } from "../../lib/employee-resolution";
import {
  detectAdapterCapabilities,
  warnIfNoAdapters,
} from "../../shared/adapter-capability";
import { hasOnlyNonDeliveredMirrorOutcomes } from "../../shared/operator-agent-check-helpers";
import {
  assertRequiredPostRoute,
  hasOptionalPostRoute,
} from "../../shared/operator-agent-surface";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";
import { ciActor, ciArtifactMarker } from "../../shared/ci-artifacts";
import { newToken } from "@aep/shared";

export {};

const CHECK_NAME = "external-approval-action-check";
const CHECK_LABEL = "external approval action check";

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
    requestedByEmployeeId: ciActor(CHECK_NAME),
    requestedByRoleId: "infra-ops-manager",
    actionType: "deploy-change",
    reason: "PR10D external approval scenario",
    message: "Seed approval thread for external approval action.",
    payload: {
      ...ciArtifactMarker(CHECK_NAME),
    },
    createThread: true,
    threadTopic: "PR10D external approval action",
    threadReceiverEmployeeId: reliabilityEngineerEmployeeId,
  });

  if (!(seeded as any)?.ok || !(seeded as any).threadId || !(seeded as any).approval?.approvalId) {
    softSkip(`failed to seed approval thread: ${JSON.stringify(seeded)}`);
  }

  const threadId = (seeded as any).threadId;
  const approvalId = (seeded as any).approval.approvalId;

  const outbound = await client.createMessage({
    companyId: "company_internal_aep",
    threadId,
    senderEmployeeId: infraOpsManagerEmployeeId,
    receiverEmployeeId: reliabilityEngineerEmployeeId,
    type: "coordination",
    source: "internal",
    subject: "PR10D approval anchor",
    body: "Create an external thread projection for approval actions.",
    payload: {
      ...ciArtifactMarker(CHECK_NAME),
    },
    relatedApprovalId: approvalId,
  });

  if (!outbound?.ok || !outbound?.messageId) {
    throw new Error(`Failed to create outbound approval anchor: ${JSON.stringify(outbound)}`);
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
    hasOnlyNonDeliveredMirrorOutcomes(outboundDeliveries)
  ) {
    softSkip("no external thread projection was formed because outbound mirror delivery was non-delivered");
  }

  assert(projections.length >= 1, "Expected an external thread projection for approval action");
  const projection = projections[0];

  const action = await client.sendExternalAction({
    source: projection.channel,
    externalActionId: `pr10d-approval-${newToken()}`,
    externalThreadId: projection.externalThreadId,
    externalAuthorId: "U_PR10D_APPROVER",
    receivedAt: new Date().toISOString(),
    actionType: "approval_approve",
    metadata: { source: "scenario-check" },
  });

  assert(action?.ok === true, `Expected external approval action success, got ${JSON.stringify(action)}`);
  assert(action?.threadId === threadId, `Expected threadId ${threadId}, got ${JSON.stringify(action)}`);

  const approvalDetail = await client.getApproval(approvalId);
  if (!(approvalDetail as any)?.ok || !(approvalDetail as any).approval) {
    throw new Error(`Failed to fetch approval detail after external action: ${JSON.stringify(approvalDetail)}`);
  }

  assert((approvalDetail as any).approval.status === "approved", `Expected approval to be approved, got ${JSON.stringify(approvalDetail)}`);

  const threadDetail = await client.getMessageThread(threadId);
  if (!threadDetail?.ok || !Array.isArray(threadDetail.messages)) {
    throw new Error(`Failed to fetch thread detail after external approval action: ${JSON.stringify(threadDetail)}`);
  }

  const hasActionMessage = threadDetail.messages.some(
    (message: any) =>
      message.source === "dashboard" &&
      message.responseActionType === "approve_approval" &&
      message.responseActionStatus === "applied" &&
      message.causedStateTransition === true,
  );

  assert(hasActionMessage, `Expected dashboard approval action message in thread history, got ${JSON.stringify(threadDetail.messages)}`);

  console.log(`- PASS: ${CHECK_LABEL}`);
  console.log(`${CHECK_NAME} passed`, {
    approvalId,
    threadId,
    projection,
  });
}

main().catch((error) => {
  console.error(`${CHECK_NAME} failed`);
  console.error(error);
  process.exit(1);
});
