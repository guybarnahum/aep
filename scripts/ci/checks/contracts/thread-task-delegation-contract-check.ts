/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

function findAppliedActionMessage(messages: any[], actionType: string): any {
  return messages.find(
    (message) =>
      message.responseActionType === actionType
      && message.responseActionStatus === "applied",
  );
}

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  try {
    await client.endpointExists("/agent/message-threads");
  } catch (err) {
    if (handleOperatorAgentSoftSkip("thread-task-delegation-contract-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  const seededPrimary = await client.seedApproval({
    requestedByEmployeeId: "emp_infra_ops_manager_01",
    requestedByRoleId: "infra-ops-manager",
    actionType: "deploy-change",
    reason: "PR7.7 delegation contract check primary approval",
    message: "Approve this primary request for delegation contract coverage.",
    createThread: true,
    threadTopic: "PR7.7 primary approval thread",
    threadReceiverEmployeeId: "emp_val_specialist_01",
  });

  const seededSecondary = await client.seedApproval({
    requestedByEmployeeId: "emp_infra_ops_manager_01",
    requestedByRoleId: "infra-ops-manager",
    actionType: "deploy-change",
    reason: "PR7.7 delegation contract check secondary approval",
    message: "Approve this secondary request for lineage mismatch coverage.",
    createThread: true,
    threadTopic: "PR7.7 secondary approval thread",
    threadReceiverEmployeeId: "emp_val_specialist_01",
  });

  const primaryApprovalId = (seededPrimary as any)?.approval?.approvalId;
  const primaryThreadId = (seededPrimary as any)?.threadId;
  const secondaryThreadId = (seededSecondary as any)?.threadId;

  if (!primaryApprovalId || !primaryThreadId || !secondaryThreadId) {
    throw new Error(
      `Failed to seed approvals with threads: ${JSON.stringify({ seededPrimary, seededSecondary })}`,
    );
  }

  const actionResult = await client.approveFromThread(primaryThreadId, {
    actor: "human_thread_actor",
    note: "Approval action before delegation",
  });

  if (!(actionResult as any)?.ok) {
    throw new Error(`Unexpected thread approval action result: ${JSON.stringify(actionResult)}`);
  }

  const approvalDetail = await client.getApproval(primaryApprovalId);
  const approvalMessages = Array.isArray((approvalDetail as any)?.messages)
    ? (approvalDetail as any).messages
    : [];
  const actionMessage = findAppliedActionMessage(approvalMessages, "approve_approval");

  if (!actionMessage?.id) {
    throw new Error(`Failed to locate applied approval action message: ${JSON.stringify(approvalDetail)}`);
  }

  let mismatchRejected = false;
  try {
    await client.delegateTaskFromThread(secondaryThreadId, {
      originatingTeamId: "team_infra",
      assignedTeamId: "team_validation",
      createdByEmployeeId: "operator",
      taskType: "followup_validation",
      title: "This should fail due to thread/message mismatch",
      payload: { reason: "mismatch_check" },
      sourceMessageId: actionMessage.id,
    });
  } catch (error) {
    const message = String(error);
    mismatchRejected = message.includes("400") || message.includes("does not belong to thread");
  }

  if (!mismatchRejected) {
    throw new Error("Expected mismatched thread/message delegation request to fail with 400");
  }

  const delegationResult = await client.delegateTaskFromThread(primaryThreadId, {
    originatingTeamId: "team_infra",
    assignedTeamId: "team_validation",
    ownerEmployeeId: "emp_infra_ops_manager_01",
    assignedEmployeeId: "emp_val_specialist_01",
    createdByEmployeeId: "operator",
    taskType: "followup_validation",
    title: "Validate approved remediation outcome",
    payload: { reason: "approval_outcome_followup" },
    sourceMessageId: actionMessage.id,
  });

  if (!(delegationResult as any)?.ok || !(delegationResult as any).taskId) {
    throw new Error(`Unexpected delegation result: ${JSON.stringify(delegationResult)}`);
  }

  const taskId = (delegationResult as any).taskId;
  const taskDetail = await client.getTask(taskId);

  if (!(taskDetail as any)?.ok || !(taskDetail as any).task) {
    throw new Error(`Failed to fetch delegated task detail: ${JSON.stringify(taskDetail)}`);
  }

  const task = (taskDetail as any).task;

  if (task.sourceThreadId !== primaryThreadId) {
    throw new Error(`Expected sourceThreadId=${primaryThreadId}, got ${JSON.stringify(task)}`);
  }
  if (task.sourceMessageId !== actionMessage.id) {
    throw new Error(`Expected sourceMessageId=${actionMessage.id}, got ${JSON.stringify(task)}`);
  }
  if (task.sourceApprovalId !== primaryApprovalId) {
    throw new Error(`Expected sourceApprovalId=${primaryApprovalId}, got ${JSON.stringify(task)}`);
  }
  if (typeof task.sourceEscalationId !== "undefined") {
    throw new Error(`Expected sourceEscalationId to be absent, got ${JSON.stringify(task)}`);
  }

  const threadDetail = await client.getMessageThread(primaryThreadId);
  const threadMessages = Array.isArray((threadDetail as any)?.messages)
    ? (threadDetail as any).messages
    : [];

  const hasDelegationActionMessage = threadMessages.some(
    (message: any) =>
      message.id === (delegationResult as any).delegationMessageId
      && message.source === "dashboard"
      && message.responseActionType === "delegate_task"
      && message.responseActionStatus === "applied"
      && message.relatedTaskId === taskId,
  );

  const hasDelegationSystemMessage = threadMessages.some(
    (message: any) =>
      message.source === "system"
      && message.subject === "Follow-up task delegated"
      && message.relatedTaskId === taskId,
  );

  if (!hasDelegationActionMessage || !hasDelegationSystemMessage) {
    throw new Error(`Expected durable delegation messages in thread: ${JSON.stringify(threadMessages)}`);
  }

  console.log("thread-task-delegation-contract-check passed", {
    approvalId: primaryApprovalId,
    threadId: primaryThreadId,
    sourceMessageId: actionMessage.id,
    taskId,
  });
}

main().catch((error) => {
  console.error("thread-task-delegation-contract-check failed");
  console.error(error);
  process.exit(1);
});