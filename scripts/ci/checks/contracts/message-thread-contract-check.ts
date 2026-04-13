/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

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
    topic: "PR7.2 thread contract",
    createdByEmployeeId: "emp_infra_ops_manager_01",
    relatedTaskId: "task_fake_pr72_thread",
    visibility: "internal",
  });

  if (!thread?.ok || !thread?.threadId) {
    throw new Error(`Failed to create message thread: ${JSON.stringify(thread)}`);
  }

  const firstMessage = await client.createMessage({
    companyId: "company_internal_aep",
    threadId: thread.threadId,
    senderEmployeeId: "emp_infra_ops_manager_01",
    receiverEmployeeId: "emp_val_specialist_01",
    type: "coordination",
    source: "internal",
    subject: "Please review",
    body: "Review the task-linked context in this thread.",
    requiresResponse: true,
    relatedTaskId: "task_fake_pr72_thread",
  });

  if (!firstMessage?.ok || !firstMessage?.messageId) {
    throw new Error(`Failed to create first message: ${JSON.stringify(firstMessage)}`);
  }

  const reply = await client.createMessage({
    companyId: "company_internal_aep",
    threadId: thread.threadId,
    senderEmployeeId: "emp_val_specialist_01",
    receiverEmployeeId: "emp_infra_ops_manager_01",
    type: "coordination",
    source: "internal",
    body: "Acknowledged. Reviewing now.",
    relatedTaskId: "task_fake_pr72_thread",
  });

  if (!reply?.ok || !reply?.messageId) {
    throw new Error(`Failed to create reply: ${JSON.stringify(reply)}`);
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

  const inbox = await client.getInbox("emp_val_specialist_01");

  if (!inbox?.ok || !Array.isArray(inbox.messages)) {
    throw new Error(`Failed to fetch inbox: ${JSON.stringify(inbox)}`);
  }

  const inboxHasThread = inbox.messages.some((message: any) => message.threadId === thread.threadId);
  if (!inboxHasThread) {
    throw new Error(`Expected inbox to include thread message: ${JSON.stringify(inbox)}`);
  }

  const outbox = await client.getOutbox("emp_infra_ops_manager_01");

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
  });
}

main().catch((error) => {
  console.error("message-thread-contract-check failed");
  console.error(error);
  process.exit(1);
});