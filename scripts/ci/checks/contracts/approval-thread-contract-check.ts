/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  try {
    await client.endpointExists("/agent/approvals");
  } catch (err) {
    if (handleOperatorAgentSoftSkip("approval-thread-contract-check", err)) {
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

  if (!(approvals as any)?.ok || entries.length === 0) {
    throw new Error(`Expected at least one approval to exist: ${JSON.stringify(approvals)}`);
  }

  const pendingApproval = entries.find((entry: any) => entry.status === "pending");

  if (!pendingApproval) {
    console.log("approval-thread-contract-check skipped", {
      reason: "no pending approvals available",
    });
    process.exit(0);
  }

  const approvalId = pendingApproval.approvalId ?? pendingApproval.id;
  const approveResult = await client.approveApproval({
    approvalId,
    decidedBy: "human_ci_operator",
    decisionNote: "Approved via approval thread contract check",
  });

  const approvalDetail = await client.getApproval(approvalId);

  if (!(approvalDetail as any)?.ok || !(approvalDetail as any).approval) {
    throw new Error(`Failed to fetch approval detail: ${JSON.stringify(approvalDetail)}`);
  }

  if (!(approvalDetail as any).thread || !(approvalDetail as any).thread.relatedApprovalId) {
    throw new Error(`Expected approval detail to include linked thread: ${JSON.stringify(approvalDetail)}`);
  }

  if (!Array.isArray((approvalDetail as any).messages) || (approvalDetail as any).messages.length === 0) {
    throw new Error(`Expected approval detail to include messages: ${JSON.stringify(approvalDetail)}`);
  }

  const hasSystemDecisionMessage = (approvalDetail as any).messages.some(
    (message: any) =>
      message.source === "system"
      && message.relatedApprovalId === approvalId
      && typeof message.subject === "string"
      && message.subject.length > 0
      && typeof message.body === "string"
      && message.body.length > 0
      && /approved|rejected/i.test(message.body),
  );

  if (!hasSystemDecisionMessage) {
    throw new Error(
      `Expected system approval decision message with subject/body/outcome text: ${JSON.stringify((approvalDetail as any).messages)}`,
    );
  }

  console.log("approval-thread-contract-check passed", {
    approvalId,
    threadId: (approvalDetail as any).thread.id,
    messageCount: (approvalDetail as any).messages.length,
    approveResult,
  });
}

main().catch((error) => {
  console.error("approval-thread-contract-check failed");
  console.error(error);
  process.exit(1);
});