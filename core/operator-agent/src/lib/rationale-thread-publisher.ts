import {
  deriveThreadRationaleMessage,
} from "@aep/operator-agent/lib/employee-cognition";
import type {
  EmployeePublicRationale,
  EmployeeThreadRationaleMessage,
} from "@aep/operator-agent/lib/employee-cognition";
import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type { TaskStore } from "@aep/operator-agent/lib/store-types";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export interface PublishTaskRationaleToThreadArgs {
  env: OperatorAgentEnv;
  companyId: string;
  taskId: string;
  artifactId: string;
  employeeId: string;
  rationale: EmployeePublicRationale;
}

export interface PublishTaskRationaleToThreadResult {
  published: boolean;
  threadId?: string;
  messageId?: string;
  reason?: "no_thread" | "already_published";
}

function rationaleMessageId(threadId: string): string {
  return `msg_rat_${threadId}_${crypto.randomUUID().split("-")[0]}`;
}

async function findRelatedThread(
  store: TaskStore,
  companyId: string,
  taskId: string,
): Promise<string | undefined> {
  const threads = await store.listMessageThreads({
    companyId,
    relatedTaskId: taskId,
    limit: 10,
  });

  if (!threads.length) {
    return undefined;
  }

  return threads[0]?.id;
}

async function alreadyPublished(args: {
  store: TaskStore;
  threadId: string;
  artifactId: string;
}): Promise<boolean> {
  const existing = await args.store.listMessages({
    threadId: args.threadId,
    relatedArtifactId: args.artifactId,
    limit: 20,
  });

  return existing.some(
    (message) =>
      message.payload?.kind === "public_rationale_publication"
      && message.relatedArtifactId === args.artifactId,
  );
}

export async function publishTaskRationaleToThread(
  args: PublishTaskRationaleToThreadArgs,
): Promise<PublishTaskRationaleToThreadResult> {
  const store = getTaskStore(args.env);

  const threadId = await findRelatedThread(store, args.companyId, args.taskId);
  if (!threadId) {
    return {
      published: false,
      reason: "no_thread",
    };
  }

  const exists = await alreadyPublished({
    store,
    threadId,
    artifactId: args.artifactId,
  });

  if (exists) {
    return {
      published: false,
      threadId,
      reason: "already_published",
    };
  }

  const message: EmployeeThreadRationaleMessage = deriveThreadRationaleMessage(args.rationale);
  const messageId = rationaleMessageId(threadId);

  await store.createMessage({
    id: messageId,
    threadId,
    companyId: args.companyId,
    senderEmployeeId: args.employeeId,
    receiverEmployeeId: args.employeeId,
    type: "coordination",
    status: "delivered",
    source: "system",
    subject: message.subject,
    body: message.body,
    payload: {
      kind: "public_rationale_publication",
      presentationStyle: args.rationale.presentationStyle,
      summary: args.rationale.summary,
      recommendedNextAction: args.rationale.recommendedNextAction,
    },
    requiresResponse: false,
    relatedTaskId: args.taskId,
    relatedArtifactId: args.artifactId,
  });

  return {
    published: true,
    threadId,
    messageId,
  };
}