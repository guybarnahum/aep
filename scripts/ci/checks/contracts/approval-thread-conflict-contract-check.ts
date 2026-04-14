/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
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

  try {
    await client.endpointExists("/agent/message-threads");
  } catch (err) {
    if (handleOperatorAgentSoftSkip("approval-thread-conflict-contract-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  const seeded = await client.seedApproval({
    requestedByEmployeeId: "emp_infra_ops_manager_01",
    requestedByRoleId: "infra-ops-manager",
    actionType: "deploy-change",
    reason: "PR7.6 conflict action test",
    message: "Please approve this seeded request from the thread.",
    createThread: true,
    threadTopic: "PR7.6 approval conflict action",
    threadReceiverEmployeeId: "emp_val_specialist_01",
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