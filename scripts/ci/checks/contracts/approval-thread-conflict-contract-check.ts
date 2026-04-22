/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveServiceBaseUrl } from "../../../lib/service-map";
import { resolveEmployeeIdsByKey } from "../../lib/employee-resolution";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

function extractConflictPayload(error: unknown): Record<string, unknown> | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const match = error.message.match(/^Request failed: \d+ (.+)$/);
  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return null;
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
    await client.endpointExists("/agent/message-threads");
  } catch (err) {
    if (handleOperatorAgentSoftSkip("approval-thread-conflict-contract-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  const seeded = await client.seedApproval({
    requestedByEmployeeId: infraOpsManagerEmployeeId,
    requestedByRoleId: "infra-ops-manager",
    actionType: "deploy-change",
    reason: "PR7.6 conflict action test",
    message: "Please approve this seeded request from the thread.",
    createThread: true,
    threadTopic: "PR7.6 approval conflict action",
    threadReceiverEmployeeId: reliabilityEngineerEmployeeId,
  });

  if (!(seeded as any)?.ok || !(seeded as any).approval?.approvalId || !(seeded as any).threadId) {
    throw new Error(`Failed to seed approval with thread: ${JSON.stringify(seeded)}`);
  }

  const approvalId = (seeded as any).approval.approvalId;
  const threadId = (seeded as any).threadId;

  const first = await client.approveFromThread(threadId, {
    actor: "first_actor",
    note: "First thread approval action",
  });

  if (!(first as any)?.ok) {
    throw new Error(`Expected first thread approval action to succeed: ${JSON.stringify(first)}`);
  }

  let second: Record<string, unknown> | null = null;

  try {
    second = await client.approveFromThread(threadId, {
      actor: "second_actor",
      note: "Second thread approval action should conflict",
    });
  } catch (error) {
    second = extractConflictPayload(error);
    if (!second) {
      throw error;
    }
  }

  if ((second as any)?.ok || (second as any)?.error !== "Approval is no longer pending") {
    throw new Error(`Expected second thread approval action to conflict: ${JSON.stringify(second)}`);
  }

  const threadDetail = await client.getMessageThread(threadId);

  if (!(threadDetail as any)?.ok || !Array.isArray((threadDetail as any).messages)) {
    throw new Error(`Failed to fetch thread detail: ${JSON.stringify(threadDetail)}`);
  }

  const hasConflictActionMessage = (threadDetail as any).messages.some(
    (message: any) =>
      message.source === "dashboard"
      && message.responseActionType === "approve_approval"
      && message.responseActionStatus === "rejected"
      && message.causedStateTransition === false,
  );

  if (!hasConflictActionMessage) {
    throw new Error(
      `Expected rejected dashboard conflict action message in thread: ${JSON.stringify((threadDetail as any).messages)}`,
    );
  }

  console.log("approval-thread-conflict-contract-check passed", {
    approvalId,
    threadId,
    messageCount: (threadDetail as any).messages.length,
  });
}

main().catch((error) => {
  console.error("approval-thread-conflict-contract-check failed");
  console.error(error);
  process.exit(1);
});