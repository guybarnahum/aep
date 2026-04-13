/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  try {
    await client.endpointExists("/agent/escalations");
  } catch (err) {
    if (handleOperatorAgentSoftSkip("escalation-thread-contract-check", err)) {
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

  if (!(escalations as any)?.ok || entries.length === 0) {
    throw new Error(`Expected at least one escalation to exist: ${JSON.stringify(escalations)}`);
  }

  const openEscalation = entries.find((entry: any) => entry.state === "open");

  if (!openEscalation) {
    console.log("escalation-thread-contract-check skipped", {
      reason: "no open escalations available",
    });
    process.exit(0);
  }

  const escalationId = openEscalation.escalationId ?? openEscalation.id;

  const acknowledgeResult = await client.acknowledgeEscalation({
    escalationId,
    actor: "human_ci_operator",
  });

  if (!(acknowledgeResult as any)?.ok) {
    throw new Error(
      `Failed to acknowledge escalation ${escalationId}: ${JSON.stringify(acknowledgeResult)}`,
    );
  }

  const escalationDetail = await client.getEscalation(escalationId);

  if (!(escalationDetail as any)?.ok || !(escalationDetail as any).escalation) {
    throw new Error(`Failed to fetch escalation detail: ${JSON.stringify(escalationDetail)}`);
  }

  if (!(escalationDetail as any).thread || !(escalationDetail as any).thread.relatedEscalationId) {
    throw new Error(
      `Expected escalation detail to include linked thread: ${JSON.stringify(escalationDetail)}`,
    );
  }

  if (
    !Array.isArray((escalationDetail as any).messages)
    || (escalationDetail as any).messages.length === 0
  ) {
    throw new Error(
      `Expected escalation detail to include messages: ${JSON.stringify(escalationDetail)}`,
    );
  }

  const hasSystemEscalationMessage = (escalationDetail as any).messages.some(
    (message: any) =>
      message.source === "system"
      && message.relatedEscalationId === escalationId
      && typeof message.subject === "string"
      && message.subject.length > 0
      && typeof message.body === "string"
      && message.body.length > 0
      && /acknowledged|resolved/i.test(message.body),
  );

  if (!hasSystemEscalationMessage) {
    throw new Error(
      `Expected system escalation lifecycle message: ${JSON.stringify((escalationDetail as any).messages)}`,
    );
  }

  console.log("escalation-thread-contract-check passed", {
    escalationId,
    threadId: (escalationDetail as any).thread.id,
    messageCount: (escalationDetail as any).messages.length,
    acknowledgeResult,
  });
}

main().catch((error) => {
  console.error("escalation-thread-contract-check failed");
  console.error(error);
  process.exit(1);
});