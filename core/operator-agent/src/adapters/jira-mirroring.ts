import { newId } from "@aep/shared";
import type { TaskStore } from "@aep/operator-agent/lib/store-types";

export type JiraProjectionInput = {
  threadId: string;
  externalTicketId: string;
  projectKey: string;
};

export type JiraInboundCommentInput = {
  externalTicketId: string;
  externalCommentId: string;
  body: string;
  externalAuthorId?: string;
  receivedAt: string;
};

export type JiraInboundStatusSignalInput = {
  externalTicketId: string;
  externalStatus: string;
  externalEventId: string;
  receivedAt: string;
};

const JIRA_CHANNEL = "jira" as const;

function buildProjectionTarget(projectKey: string): string {
  const normalized = projectKey.trim();
  return normalized.length > 0 ? normalized : "jira";
}

export async function syncJiraProjection(
  store: TaskStore,
  input: JiraProjectionInput,
): Promise<void> {
  const thread = await store.getMessageThread(input.threadId);
  if (!thread) {
    throw new Error("thread_not_found");
  }

  const target = buildProjectionTarget(input.projectKey);
  const existingForTicket = await store.listExternalThreadProjectionsByExternal({
    channel: JIRA_CHANNEL,
    externalThreadId: input.externalTicketId,
    target,
  });

  if (existingForTicket.length > 0) {
    const mapped = existingForTicket[0];
    if (mapped.threadId !== input.threadId) {
      throw new Error("external_ticket_mapped_to_other_thread");
    }
    return;
  }

  await store.createExternalThreadProjection({
    id: newId("extthr"),
    threadId: input.threadId,
    channel: JIRA_CHANNEL,
    target,
    externalThreadId: input.externalTicketId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function ingestJiraComment(
  store: TaskStore,
  input: JiraInboundCommentInput,
): Promise<{ threadId: string; messageId: string }> {
  const mappings = await store.listExternalThreadProjectionsByExternal({
    channel: JIRA_CHANNEL,
    externalThreadId: input.externalTicketId,
  });

  if (mappings.length === 0) {
    throw new Error("ticket_not_mapped");
  }

  const projection = mappings[0];
  const thread = await store.getMessageThread(projection.threadId);
  if (!thread) {
    throw new Error("thread_not_found");
  }

  const created = await store.createMessage({
    id: newId("msg"),
    threadId: thread.id,
    companyId: thread.companyId,
    senderEmployeeId: "system_jira_bridge",
    receiverTeamId: "team_web_product",
    type: "coordination",
    status: "delivered",
    source: "system",
    subject: "Jira comment mirrored",
    body: input.body,
    payload: {
      externalAdapter: "jira",
      externalTicketId: input.externalTicketId,
      externalCommentId: input.externalCommentId,
      externalAuthorId: input.externalAuthorId,
      receivedAt: input.receivedAt,
      mirrorOnly: true,
    },
    requiresResponse: false,
  });

  await store.createExternalMessageProjection({
    id: newId("extmsg"),
    messageId: created.id,
    threadId: thread.id,
    channel: JIRA_CHANNEL,
    target: projection.target,
    externalThreadId: input.externalTicketId,
    externalMessageId: input.externalCommentId,
    createdAt: new Date().toISOString(),
  });

  return {
    threadId: thread.id,
    messageId: created.id,
  };
}

export async function ingestJiraStatusSignal(
  store: TaskStore,
  input: JiraInboundStatusSignalInput,
): Promise<{ threadId: string; messageId: string }> {
  const mappings = await store.listExternalThreadProjectionsByExternal({
    channel: JIRA_CHANNEL,
    externalThreadId: input.externalTicketId,
  });

  if (mappings.length === 0) {
    throw new Error("ticket_not_mapped");
  }

  const projection = mappings[0];
  const thread = await store.getMessageThread(projection.threadId);
  if (!thread) {
    throw new Error("thread_not_found");
  }

  const created = await store.createMessage({
    id: newId("msg"),
    threadId: thread.id,
    companyId: thread.companyId,
    senderEmployeeId: "system_jira_bridge",
    receiverTeamId: "team_web_product",
    type: "coordination",
    status: "delivered",
    source: "system",
    subject: "Jira status signal mirrored",
    body: `Jira ticket ${input.externalTicketId} moved to status \"${input.externalStatus}\".`,
    payload: {
      externalAdapter: "jira",
      externalTicketId: input.externalTicketId,
      externalStatus: input.externalStatus,
      externalEventId: input.externalEventId,
      receivedAt: input.receivedAt,
      signalOnly: true,
      noDirectCanonicalMutation: true,
    },
    requiresResponse: false,
  });

  return {
    threadId: thread.id,
    messageId: created.id,
  };
}
