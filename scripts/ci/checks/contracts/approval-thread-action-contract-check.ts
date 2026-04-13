/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  try {
    await client.endpointExists("/agent/message-threads");
  } catch (err) {
    if (handleOperatorAgentSoftSkip("approval-thread-action-contract-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  const approvals = await client.listApprovals({ limit: 20 });

  const entries = Array.isArray((approvals as any)?.entries)
    ? (approvals as any).entries
    : Array.isArray((approvals as any)?.approvals)
      ? (approvals as any).approvals
      : [];

  const pendingApproval = entries.find((entry: any) => entry.status === "pending");

  if (!pendingApproval) {
    console.log("approval-thread-action-contract-check skipped", {
      reason: "no pending approvals available",
    });
    process.exit(0);
  }

  const approvalId = pendingApproval.approvalId ?? pendingApproval.id;

  await client.approveApproval({
    approvalId,
    decidedBy: "seed_thread_operator",
    decisionNote: "Seed thread for PR7.5 thread-action check",
  });

  const detail = await client.getApproval(approvalId);

  if (!(detail as any)?.ok || !(detail as any).thread?.id) {
    throw new Error(`Expected approval thread to exist: ${JSON.stringify(detail)}`);
  }

  const threadId = (detail as any).thread.id;

  const actionResult = await client.approveFromThread(threadId, {
    actor: "human_thread_actor",
    note: "Thread approval action",
  });

  if (!(actionResult as any)?.ok && (actionResult as any)?.status !== 409) {
    throw new Error(`Unexpected thread approval action result: ${JSON.stringify(actionResult)}`);
  }

  const threadDetail = await client.getMessageThread(threadId);

  if (!(threadDetail as any)?.ok || !Array.isArray((threadDetail as any).messages)) {
    throw new Error(`Failed to fetch thread detail: ${JSON.stringify(threadDetail)}`);
  }

  const hasActionMessage = (threadDetail as any).messages.some(
    (message: any) =>
      message.source === "dashboard"
      && message.responseActionType === "approve_approval"
      && message.responseActionStatus === "applied",
  );

  if (!hasActionMessage) {
    throw new Error(`Expected dashboard action message in thread: ${JSON.stringify((threadDetail as any).messages)}`);
  }

  console.log("approval-thread-action-contract-check passed", {
    approvalId,
    threadId,
    messageCount: (threadDetail as any).messages.length,
  });
}

main().catch((error) => {
  console.error("approval-thread-action-contract-check failed");
  console.error(error);
  process.exit(1);
});