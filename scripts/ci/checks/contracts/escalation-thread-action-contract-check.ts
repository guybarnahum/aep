/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  try {
    await client.endpointExists("/agent/message-threads");
  } catch (err) {
    if (handleOperatorAgentSoftSkip("escalation-thread-action-contract-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  const escalations = await client.listEscalations({ limit: 20 });

  const entries = Array.isArray((escalations as any)?.entries)
    ? (escalations as any).entries
    : Array.isArray((escalations as any)?.escalations)
      ? (escalations as any).escalations
      : [];

  const openEscalation = entries.find((entry: any) => entry.state === "open");

  if (!openEscalation) {
    console.log("escalation-thread-action-contract-check skipped", {
      reason: "no open escalations available",
    });
    process.exit(0);
  }

  const escalationId = openEscalation.escalationId ?? openEscalation.id;

  await client.acknowledgeEscalation({
    escalationId,
    actor: "seed_thread_operator",
  });

  const detail = await client.getEscalation(escalationId);

  if (!(detail as any)?.ok || !(detail as any).thread?.id) {
    throw new Error(`Expected escalation thread to exist: ${JSON.stringify(detail)}`);
  }

  const threadId = (detail as any).thread.id;

  const actionResult = await client.resolveEscalationFromThread(threadId, {
    actor: "human_thread_actor",
    note: "Resolved through thread action",
  });

  if (!(actionResult as any)?.ok) {
    throw new Error(`Unexpected thread escalation action result: ${JSON.stringify(actionResult)}`);
  }

  const threadDetail = await client.getMessageThread(threadId);

  if (!(threadDetail as any)?.ok || !Array.isArray((threadDetail as any).messages)) {
    throw new Error(`Failed to fetch thread detail: ${JSON.stringify(threadDetail)}`);
  }

  const hasActionMessage = (threadDetail as any).messages.some(
    (message: any) =>
      message.source === "dashboard"
      && message.responseActionType === "resolve_escalation"
      && message.responseActionStatus === "applied"
      && message.causedStateTransition === true,
  );

  if (!hasActionMessage) {
    throw new Error(`Expected dashboard escalation action message in thread: ${JSON.stringify((threadDetail as any).messages)}`);
  }

  console.log("escalation-thread-action-contract-check passed", {
    escalationId,
    threadId,
    messageCount: (threadDetail as any).messages.length,
  });
}

main().catch((error) => {
  console.error("escalation-thread-action-contract-check failed");
  console.error(error);
  process.exit(1);
});