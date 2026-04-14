/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  try {
    await client.endpointExists("/agent/message-threads");
  } catch (err) {
    if (handleOperatorAgentSoftSkip("approval-thread-delegation-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  const seeded = await client.seedApproval({
    requestedByEmployeeId: "emp_infra_ops_manager_01",
    requestedByRoleId: "infra-ops-manager",
    actionType: "deploy-change",
    reason: "PR7.7 approval-thread delegation scenario",
    message: "Approval-thread delegation scenario seed.",
    createThread: true,
    threadTopic: "PR7.7 approval-thread delegation",
    threadReceiverEmployeeId: "emp_val_specialist_01",
  });

  const approvalId = (seeded as any)?.approval?.approvalId;
  const threadId = (seeded as any)?.threadId;

  if (!approvalId || !threadId) {
    throw new Error(`Failed to seed approval thread: ${JSON.stringify(seeded)}`);
  }

  const approvalAction = await client.approveFromThread(threadId, {
    actor: "scenario_operator",
    note: "Scenario approval before delegation",
  });

  if (!(approvalAction as any)?.ok) {
    throw new Error(`Unexpected approval action result: ${JSON.stringify(approvalAction)}`);
  }

  const approvalDetail = await client.getApproval(approvalId);
  const actionMessage = ((approvalDetail as any)?.messages ?? []).find(
    (message: any) =>
      message.responseActionType === "approve_approval"
      && message.responseActionStatus === "applied",
  );

  if (!actionMessage?.id) {
    throw new Error(`Failed to locate approval action message: ${JSON.stringify(approvalDetail)}`);
  }

  const delegation = await client.delegateTaskFromThread(threadId, {
    originatingTeamId: "team_infra",
    assignedTeamId: "team_validation",
    assignedEmployeeId: "emp_val_specialist_01",
    createdByEmployeeId: "scenario_operator",
    taskType: "followup_validation",
    title: "Validate approved remediation outcome",
    payload: { reason: "approval_outcome_followup" },
    sourceMessageId: actionMessage.id,
  });

  if (!(delegation as any)?.ok || !(delegation as any).taskId) {
    throw new Error(`Unexpected delegation result: ${JSON.stringify(delegation)}`);
  }

  const taskId = (delegation as any).taskId;
  const taskDetail = await client.getTask(taskId);

  if (!(taskDetail as any)?.ok || !(taskDetail as any).task) {
    throw new Error(`Failed to fetch delegated task detail: ${JSON.stringify(taskDetail)}`);
  }

  const task = (taskDetail as any).task;

  if (task.status !== "ready") {
    throw new Error(`Expected delegated task to be ready without dependencies: ${JSON.stringify(task)}`);
  }
  if (task.sourceThreadId !== threadId || task.sourceMessageId !== actionMessage.id || task.sourceApprovalId !== approvalId) {
    throw new Error(`Delegated task provenance mismatch: ${JSON.stringify(task)}`);
  }

  const threadDetail = await client.getMessageThread(threadId);
  const messages = Array.isArray((threadDetail as any)?.messages)
    ? (threadDetail as any).messages
    : [];

  const hasDelegationAction = messages.some(
    (message: any) =>
      message.responseActionType === "delegate_task"
      && message.responseActionStatus === "applied"
      && message.relatedTaskId === taskId,
  );
  const hasDelegationSystem = messages.some(
    (message: any) =>
      message.subject === "Follow-up task delegated"
      && message.source === "system"
      && message.relatedTaskId === taskId,
  );

  if (!hasDelegationAction || !hasDelegationSystem) {
    throw new Error(`Expected thread delegation history messages: ${JSON.stringify(messages)}`);
  }

  console.log("approval-thread-delegation-check passed", {
    approvalId,
    threadId,
    taskId,
  });
}

main().catch((error) => {
  console.error("approval-thread-delegation-check failed");
  console.error(error);
  process.exit(1);
});