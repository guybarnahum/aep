/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveServiceBaseUrl } from "../../../lib/service-map";
import { resolveEmployeeIdsByKey } from "../../lib/employee-resolution";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

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
        key: "reliabilityEngineer",
        roleId: "reliability-engineer",
        teamId: "team_validation",
        runtimeStatus: "implemented",
      },
    ],
  });
  const reliabilityEngineerEmployeeId = liveEmployeeIds.reliabilityEngineer;

  try {
    await client.endpointExists("/agent/message-threads");
  } catch (err) {
    if (handleOperatorAgentSoftSkip("approval-thread-delegation-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  const approvals = await client.listApprovals({ limit: 50 });

  const entries = Array.isArray((approvals as any)?.entries)
    ? (approvals as any).entries
    : Array.isArray((approvals as any)?.approvals)
      ? (approvals as any).approvals
      : [];

  if (!(approvals as any)?.ok) {
    throw new Error(`Failed to list approvals: ${JSON.stringify(approvals)}`);
  }

  if (entries.length === 0) {
    console.log("approval-thread-delegation-check skipped", {
      reason: "no approvals available",
    });
    process.exit(0);
  }

  let approvalEntry: any | undefined;
  let approvalDetail: any | undefined;

  for (const entry of entries) {
    const approvalId = entry.approvalId ?? entry.id;
    if (!approvalId || entry.status !== "pending") continue;

    const detail = await client.getApproval(approvalId);
    if ((detail as any)?.ok && (detail as any)?.thread?.id) {
      approvalEntry = entry;
      approvalDetail = detail;
      break;
    }
  }

  if (!approvalEntry || !approvalDetail) {
    console.log("approval-thread-delegation-check skipped", {
      reason: "no pending approval with linked thread available",
    });
    process.exit(0);
  }

  const approvalId = approvalEntry.approvalId ?? approvalEntry.id;
  const threadId = (approvalDetail as any).thread.id;

  const approvalAction = await client.approveFromThread(threadId, {
    actor: "scenario_operator",
    note: "Scenario approval before delegation",
  });

  if (!(approvalAction as any)?.ok) {
    throw new Error(`Unexpected approval action result: ${JSON.stringify(approvalAction)}`);
  }

  const refreshedApprovalDetail = await client.getApproval(approvalId);
  const actionMessage = ((refreshedApprovalDetail as any)?.messages ?? []).find(
    (message: any) =>
      message.responseActionType === "approve_approval" &&
      message.responseActionStatus === "applied",
  );

  if (!actionMessage?.id) {
    throw new Error(
      `Failed to locate approval action message: ${JSON.stringify(refreshedApprovalDetail)}`,
    );
  }

  const delegation = await client.delegateTaskFromThread(threadId, {
    originatingTeamId: "team_infra",
    assignedTeamId: "team_validation",
    assignedEmployeeId: reliabilityEngineerEmployeeId,
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
  if (
    task.sourceThreadId !== threadId ||
    task.sourceMessageId !== actionMessage.id ||
    task.sourceApprovalId !== approvalId
  ) {
    throw new Error(`Delegated task provenance mismatch: ${JSON.stringify(task)}`);
  }

  if (typeof task.sourceEscalationId !== "undefined") {
    throw new Error(`Expected no sourceEscalationId on approval delegation: ${JSON.stringify(task)}`);
  }

  const threadDetail = await client.getMessageThread(threadId);
  const messages = Array.isArray((threadDetail as any)?.messages)
    ? (threadDetail as any).messages
    : [];

  const hasDelegationAction = messages.some(
    (message: any) =>
      message.responseActionType === "delegate_task" &&
      message.responseActionStatus === "applied" &&
      message.relatedTaskId === taskId,
  );
  const hasDelegationSystem = messages.some(
    (message: any) =>
      message.subject === "Follow-up task delegated" &&
      message.source === "system" &&
      message.relatedTaskId === taskId,
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