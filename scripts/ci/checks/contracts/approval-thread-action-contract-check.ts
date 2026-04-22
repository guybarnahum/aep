/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";
import * as employeeIds from "../../shared/employee-ids";

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

  const seeded = await client.seedApproval({
    requestedByEmployeeId: employeeIds.EMPLOYEE_INFRA_OPS_MANAGER_ID,
    requestedByRoleId: "infra-ops-manager",
    actionType: "deploy-change",
    reason: "PR7.6 deterministic thread action test",
    message: "Please approve this seeded request from the thread.",
    createThread: true,
    threadTopic: "PR7.6 approval thread action",
    threadReceiverEmployeeId: employeeIds.EMPLOYEE_RELIABILITY_ENGINEER_ID,
  });

  if (!(seeded as any)?.ok || !(seeded as any).approval?.approvalId || !(seeded as any).threadId) {
    throw new Error(`Failed to seed approval with thread: ${JSON.stringify(seeded)}`);
  }

  const approvalId = (seeded as any).approval.approvalId;
  const threadId = (seeded as any).threadId;

  const actionResult = await client.approveFromThread(threadId, {
    actor: "human_thread_actor",
    note: "Thread approval action",
  });

  if (!(actionResult as any)?.ok) {
    throw new Error(`Unexpected thread approval action result: ${JSON.stringify(actionResult)}`);
  }

  const detail = await client.getApproval(approvalId);

  if (!(detail as any)?.ok || !(detail as any).approval) {
    throw new Error(`Failed to fetch approval detail: ${JSON.stringify(detail)}`);
  }

  if ((detail as any).approval.status !== "approved") {
    throw new Error(`Expected approval to be approved by thread action: ${JSON.stringify(detail)}`);
  }

  const threadDetail = await client.getMessageThread(threadId);

  if (!(threadDetail as any)?.ok || !Array.isArray((threadDetail as any).messages)) {
    throw new Error(`Failed to fetch thread detail: ${JSON.stringify(threadDetail)}`);
  }

  const hasActionMessage = (threadDetail as any).messages.some(
    (message: any) =>
      message.source === "dashboard"
      && message.responseActionType === "approve_approval"
      && message.responseActionStatus === "applied"
      && message.causedStateTransition === true,
  );

  if (!hasActionMessage) {
    throw new Error(
      `Expected dashboard approval action message in thread: ${JSON.stringify((threadDetail as any).messages)}`,
    );
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