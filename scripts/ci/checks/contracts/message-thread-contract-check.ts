/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveServiceBaseUrl } from "../../../lib/service-map";
import { resolveEmployeeIdsByKey } from "../../lib/employee-resolution";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

const FORBIDDEN_PRIVATE_FIELDS = [
  "internalMonologue",
  "internal_monologue",
  "privateReasoning",
  "private_reasoning",
  "basePrompt",
  "decisionStyle",
  "collaborationStyle",
  "identitySeed",
  "portraitPrompt",
  "promptVersion",
  "base_prompt",
  "decision_style",
  "collaboration_style",
  "identity_seed",
  "portrait_prompt",
  "prompt_version",
];

function assertFieldsAbsent(payload: unknown, fields: string[], surface: string): void {
  const serialized = JSON.stringify(payload);

  for (const field of fields) {
    if (serialized.includes(field)) {
      throw new Error(`${surface} leaked private cognition field ${field}`);
    }
  }
}

function assertMessageSourceConsistency(message: Record<string, unknown>): void {
  const source = message.source;
  const externalChannel = message.externalChannel;

  if (source === "slack" && externalChannel !== "slack") {
    throw new Error(`Slack message missing matching externalChannel: ${JSON.stringify(message)}`);
  }

  if (source === "email" && externalChannel !== "email") {
    throw new Error(`Email message missing matching externalChannel: ${JSON.stringify(message)}`);
  }

  if (source === "system") {
    if (typeof message.externalMessageId !== "undefined") {
      throw new Error(`System message must not expose externalMessageId: ${JSON.stringify(message)}`);
    }

    if (typeof externalChannel !== "undefined") {
      throw new Error(`System message must not expose externalChannel: ${JSON.stringify(message)}`);
    }
  }

  if (
    typeof externalChannel !== "undefined" &&
    externalChannel !== "slack" &&
    externalChannel !== "email"
  ) {
    throw new Error(`Unexpected externalChannel on message: ${JSON.stringify(message)}`);
  }
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
  } catch (err) {
    if (handleOperatorAgentSoftSkip("message-thread-contract-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  const thread = await client.createMessageThread({
    companyId: "company_internal_aep",
    topic: "Thread contract",
    createdByEmployeeId: infraOpsManagerEmployeeId,
    relatedTaskId: "task_message_thread_contract",
    visibility: "internal",
  });

  if (!thread?.ok || !thread?.threadId) {
    throw new Error(`Failed to create message thread: ${JSON.stringify(thread)}`);
  }

  const firstMessage = await client.createMessage({
    companyId: "company_internal_aep",
    threadId: thread.threadId,
    senderEmployeeId: infraOpsManagerEmployeeId,
    receiverEmployeeId: reliabilityEngineerEmployeeId,
    type: "coordination",
    source: "internal",
    subject: "Please review",
    body: "Review the task-linked context in this thread.",
    requiresResponse: true,
    relatedTaskId: "task_message_thread_contract",
  });

  if (!firstMessage?.ok || !firstMessage?.messageId) {
    throw new Error(`Failed to create first message: ${JSON.stringify(firstMessage)}`);
  }

  const reply = await client.createMessage({
    companyId: "company_internal_aep",
    threadId: thread.threadId,
    senderEmployeeId: reliabilityEngineerEmployeeId,
    receiverEmployeeId: infraOpsManagerEmployeeId,
    type: "coordination",
    source: "internal",
    body: "Acknowledged. Reviewing now.",
    relatedTaskId: "task_message_thread_contract",
  });

  if (!reply?.ok || !reply?.messageId) {
    throw new Error(`Failed to create reply: ${JSON.stringify(reply)}`);
  }

  const externalMessage = await client.createMessage({
    companyId: "company_internal_aep",
    threadId: thread.threadId,
    senderEmployeeId: infraOpsManagerEmployeeId,
    receiverEmployeeId: reliabilityEngineerEmployeeId,
    type: "coordination",
    source: "email",
    subject: "Incoming email context",
    body: "Customer replied from email; keep this as a canonical thread message only.",
    externalChannel: "email",
    externalMessageId: "ext-message-thread-contract-email-001",
    externalAuthorId: "customer_external_author",
    externalReceivedAt: new Date().toISOString(),
    relatedTaskId: "task_message_thread_contract",
  });

  if (!externalMessage?.ok || !externalMessage?.messageId) {
    throw new Error(`Failed to create external-style message: ${JSON.stringify(externalMessage)}`);
  }

  const slackMessage = await client.createMessage({
    companyId: "company_internal_aep",
    threadId: thread.threadId,
    senderEmployeeId: reliabilityEngineerEmployeeId,
    receiverEmployeeId: infraOpsManagerEmployeeId,
    type: "coordination",
    source: "slack",
    body: "Forwarded from Slack into canonical AEP thread form.",
    externalChannel: "slack",
    externalMessageId: "ext-message-thread-contract-slack-001",
    externalAuthorId: "slack-user-123",
    externalReceivedAt: new Date().toISOString(),
    relatedTaskId: "task_message_thread_contract",
  });

  if (!slackMessage?.ok || !slackMessage?.messageId) {
    throw new Error(`Failed to create slack-style message: ${JSON.stringify(slackMessage)}`);
  }

  const threadDetail = await client.getMessageThread(thread.threadId);

  if (!threadDetail?.ok) {
    throw new Error(`Failed to fetch thread detail: ${JSON.stringify(threadDetail)}`);
  }

  if (!threadDetail.thread || threadDetail.thread.id !== thread.threadId) {
    throw new Error(`Unexpected thread detail: ${JSON.stringify(threadDetail)}`);
  }

  if (!Array.isArray(threadDetail.messages) || threadDetail.messages.length < 2) {
    throw new Error(`Expected at least 2 thread messages: ${JSON.stringify(threadDetail)}`);
  }

  threadDetail.messages.forEach((message: Record<string, unknown>, index: number) => {
    assertFieldsAbsent(
      message,
      FORBIDDEN_PRIVATE_FIELDS,
      `/agent/message-threads/${thread.threadId}/messages[${index}]`,
    );
    assertMessageSourceConsistency(message);
  });

  const persistedExternalMessage = threadDetail.messages.find(
    (message: any) => message.externalMessageId === "ext-message-thread-contract-email-001",
  );

  if (!persistedExternalMessage || persistedExternalMessage.externalChannel !== "email") {
    throw new Error(`Expected persisted email-style metadata: ${JSON.stringify(threadDetail.messages)}`);
  }

  const persistedSlackMessage = threadDetail.messages.find(
    (message: any) => message.externalMessageId === "ext-message-thread-contract-slack-001",
  );

  if (!persistedSlackMessage || persistedSlackMessage.externalChannel !== "slack") {
    throw new Error(`Expected persisted slack-style metadata: ${JSON.stringify(threadDetail.messages)}`);
  }

  const inbox = await client.getInbox(reliabilityEngineerEmployeeId);

  if (!inbox?.ok || !Array.isArray(inbox.messages)) {
    throw new Error(`Failed to fetch inbox: ${JSON.stringify(inbox)}`);
  }

  const inboxHasThread = inbox.messages.some((message: any) => message.threadId === thread.threadId);
  if (!inboxHasThread) {
    throw new Error(`Expected inbox to include thread message: ${JSON.stringify(inbox)}`);
  }

  const outbox = await client.getOutbox(infraOpsManagerEmployeeId);

  if (!outbox?.ok || !Array.isArray(outbox.messages)) {
    throw new Error(`Failed to fetch outbox: ${JSON.stringify(outbox)}`);
  }

  const outboxHasThread = outbox.messages.some((message: any) => message.threadId === thread.threadId);
  if (!outboxHasThread) {
    throw new Error(`Expected outbox to include thread message: ${JSON.stringify(outbox)}`);
  }

  console.log("message-thread-contract-check passed", {
    threadId: thread.threadId,
    messageCount: threadDetail.messages.length,
    externalMessageId: persistedExternalMessage.externalMessageId,
    slackMessageId: persistedSlackMessage.externalMessageId,
  });
}

main().catch((error) => {
  console.error("message-thread-contract-check failed");
  console.error(error);
  process.exit(1);
});