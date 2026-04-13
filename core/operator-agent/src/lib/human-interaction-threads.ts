import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export async function ensureApprovalThread(args: {
  env: OperatorAgentEnv;
  approvalId: string;
  companyId?: string;
  requestedByEmployeeId?: string;
  topic: string;
  relatedTaskId?: string;
}): Promise<string> {
  const store = getTaskStore(args.env);
  const existing = await store.findMessageThreadByApprovalId(args.approvalId);
  if (existing) return existing.id;

  const threadId = `thr_${crypto.randomUUID().split("-")[0]}`;
  await store.createMessageThread({
    id: threadId,
    companyId: args.companyId ?? "company_internal_aep",
    topic: args.topic,
    createdByEmployeeId: args.requestedByEmployeeId,
    relatedTaskId: args.relatedTaskId,
    relatedApprovalId: args.approvalId,
    visibility: "internal",
  });

  return threadId;
}

export async function ensureEscalationThread(args: {
  env: OperatorAgentEnv;
  escalationId: string;
  companyId?: string;
  createdByEmployeeId?: string;
  topic: string;
}): Promise<string> {
  const store = getTaskStore(args.env);
  const existing = await store.findMessageThreadByEscalationId(args.escalationId);
  if (existing) return existing.id;

  const threadId = `thr_${crypto.randomUUID().split("-")[0]}`;
  await store.createMessageThread({
    id: threadId,
    companyId: args.companyId ?? "company_internal_aep",
    topic: args.topic,
    createdByEmployeeId: args.createdByEmployeeId,
    relatedEscalationId: args.escalationId,
    visibility: "internal",
  });

  return threadId;
}

export async function appendSystemMessage(args: {
  env: OperatorAgentEnv;
  threadId: string;
  companyId?: string;
  senderEmployeeId: string;
  receiverEmployeeId?: string;
  receiverTeamId?: string;
  subject?: string;
  body: string;
  type?: "task" | "escalation" | "coordination";
  relatedTaskId?: string;
  relatedApprovalId?: string;
  relatedEscalationId?: string;
}): Promise<string> {
  const store = getTaskStore(args.env);
  const messageId = `msg_${crypto.randomUUID().split("-")[0]}`;

  await store.createMessage({
    id: messageId,
    threadId: args.threadId,
    companyId: args.companyId ?? "company_internal_aep",
    senderEmployeeId: args.senderEmployeeId,
    receiverEmployeeId: args.receiverEmployeeId,
    receiverTeamId: args.receiverTeamId,
    type: args.type ?? "coordination",
    status: "pending",
    source: "system",
    subject: args.subject,
    body: args.body,
    payload: {},
    requiresResponse: false,
    relatedTaskId: args.relatedTaskId,
    relatedApprovalId: args.relatedApprovalId,
    relatedEscalationId: args.relatedEscalationId,
  });

  return messageId;
}