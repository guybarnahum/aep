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
    if (handleOperatorAgentSoftSkip("escalation-thread-delegation-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  const escalations = await client.listEscalations({ limit: 20 });
  const entries = Array.isArray((escalations as any)?.entries)
    ? (escalations as any).entries
    : [];
  const openEscalation = entries.find((entry: any) => entry.state === "open");

  if (!openEscalation) {
    console.log("escalation-thread-delegation-check skipped", {
      reason: "no open escalations available",
    });
    process.exit(0);
  }

  const escalationId = openEscalation.escalationId ?? openEscalation.id;
  const acknowledged = await client.acknowledgeEscalation({
    escalationId,
    actor: "scenario_operator",
  });

  if (!(acknowledged as any)?.ok) {
    throw new Error(`Failed to acknowledge escalation: ${JSON.stringify(acknowledged)}`);
  }

  const detailAfterAck = await client.getEscalation(escalationId);
  const threadId = (detailAfterAck as any)?.thread?.id;

  if (!threadId) {
    throw new Error(`Expected escalation thread to exist: ${JSON.stringify(detailAfterAck)}`);
  }

  const resolved = await client.resolveEscalationFromThread(threadId, {
    actor: "scenario_operator",
    note: "Resolve before delegation scenario",
  });

  if (!(resolved as any)?.ok) {
    throw new Error(`Unexpected escalation thread resolve result: ${JSON.stringify(resolved)}`);
  }

  const escalationDetail = await client.getEscalation(escalationId);
  const actionMessage = ((escalationDetail as any)?.messages ?? []).find(
    (message: any) =>
      message.responseActionType === "resolve_escalation"
      && message.responseActionStatus === "applied",
  );

  if (!actionMessage?.id) {
    throw new Error(`Failed to locate resolve action message: ${JSON.stringify(escalationDetail)}`);
  }

  const delegation = await client.delegateTaskFromThread(threadId, {
    originatingTeamId: "team_infra",
    assignedTeamId: "team_validation",
    assignedEmployeeId: employeeIds.EMPLOYEE_RELIABILITY_ENGINEER_ID,
    createdByEmployeeId: "scenario_operator",
    taskType: "escalation_followup",
    title: "Validate escalation resolution outcome",
    payload: { reason: "escalation_outcome_followup" },
    sourceMessageId: actionMessage.id,
  });

  if (!(delegation as any)?.ok || !(delegation as any).taskId) {
    throw new Error(`Unexpected delegation result: ${JSON.stringify(delegation)}`);
  }

  const taskId = (delegation as any).taskId;
  const taskDetail = await client.getTask(taskId);

  if (!(taskDetail as any)?.ok || !(taskDetail as any).task) {
    throw new Error(`Failed to fetch escalation delegated task: ${JSON.stringify(taskDetail)}`);
  }

  const task = (taskDetail as any).task;

  if (task.sourceThreadId !== threadId || task.sourceMessageId !== actionMessage.id || task.sourceEscalationId !== escalationId) {
    throw new Error(`Escalation delegation provenance mismatch: ${JSON.stringify(task)}`);
  }
  if (typeof task.sourceApprovalId !== "undefined") {
    throw new Error(`Expected no sourceApprovalId on escalation delegation: ${JSON.stringify(task)}`);
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

  console.log("escalation-thread-delegation-check passed", {
    escalationId,
    threadId,
    taskId,
  });
}

main().catch((error) => {
  console.error("escalation-thread-delegation-check failed");
  console.error(error);
  process.exit(1);
});