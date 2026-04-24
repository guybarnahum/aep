/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveServiceBaseUrl } from "../../../lib/service-map";
import { resolveEmployeeIdsByKey } from "../../lib/employee-resolution";
import { hasObservableMirrorOutcome } from "../../shared/operator-agent-check-helpers";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

const CHECK_NAME = "agent-message-mirroring-check";
const CHECK_LABEL = "agent message mirroring check";

function softSkip(reason: string): never {
  console.warn(`- SKIP: ${CHECK_LABEL} (${reason})`);
  console.log(`${CHECK_NAME} skipped`, { reason });
  process.exit(0);
}

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
        key: "infraOpsManager",
        roleId: "infra-ops-manager",
        teamId: "team_infra",
        runtimeStatus: "implemented",
      },
      {
        key: "reliabilityEngineer",
        roleId: "reliability-engineer",
        teamId: "team_validation",
        runtimeStatus: "implemented",
      },
    ],
  });
  const infraOpsManagerEmployeeId = liveEmployeeIds.infraOpsManager;
  const reliabilityEngineerEmployeeId = liveEmployeeIds.reliabilityEngineer;

  try {
    await client.endpointExists("/agent/message-threads");
  } catch (error) {
    if (handleOperatorAgentSoftSkip(CHECK_NAME, error)) {
      process.exit(0);
    }
    throw error;
  }

  const thread = await client.createMessageThread({
    companyId: "company_internal_aep",
    topic: "PR10A agent message mirroring check",
    createdByEmployeeId: infraOpsManagerEmployeeId,
    relatedTaskId: "task_pr10a_agent_mirroring",
    visibility: "internal",
  });

  if (!thread?.ok || !thread?.threadId) {
    softSkip(`failed to create suitable canonical thread context: ${JSON.stringify(thread)}`);
  }

  const created = await client.createMessage({
    companyId: "company_internal_aep",
    threadId: thread.threadId,
    senderEmployeeId: infraOpsManagerEmployeeId,
    receiverEmployeeId: reliabilityEngineerEmployeeId,
    type: "coordination",
    source: "internal",
    subject: "Mirror this canonical agent message",
    body: "Agent-originated canonical thread messages must produce a human-visible mirror attempt.",
    relatedTaskId: "task_pr10a_agent_mirroring",
  });

  if (!created?.ok || !created?.messageId) {
    throw new Error(`Failed to create agent-originated canonical message: ${JSON.stringify(created)}`);
  }

  const detail = await client.getMessageThread(thread.threadId);
  if (!detail?.ok || !Array.isArray(detail.messages)) {
    throw new Error(`Failed to load mirrored thread detail: ${JSON.stringify(detail)}`);
  }

  const message = detail.messages.find((entry: any) => entry.id === created.messageId);
  if (!message) {
    throw new Error(`Failed to locate created canonical message in thread: ${JSON.stringify(detail.messages)}`);
  }

  if (!Array.isArray(message.mirrorDeliveries) || message.mirrorDeliveries.length === 0) {
    throw new Error(`Expected at least one mirror delivery record for message ${created.messageId}`);
  }

  const hasObservableOutcome = hasObservableMirrorOutcome(message.mirrorDeliveries);

  if (!hasObservableOutcome) {
    throw new Error(`Expected delivered, failed, or skipped mirror outcome, got ${JSON.stringify(message.mirrorDeliveries)}`);
  }

  console.log(`- PASS: ${CHECK_LABEL}`);
  console.log(`${CHECK_NAME} passed`, {
    threadId: thread.threadId,
    messageId: created.messageId,
    mirrorDeliveries: message.mirrorDeliveries,
  });
}

main().catch((error) => {
  console.error(`${CHECK_NAME} failed`);
  console.error(error);
  process.exit(1);
});