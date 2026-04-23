import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import { newId } from "@aep/shared";
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

  const threadId = newId("thr");
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

  const threadId = newId("thr");
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
  const messageId = newId("msg");

  await store.createMessage({
    id: messageId,
    threadId: args.threadId,
    companyId: args.companyId ?? "company_internal_aep",
    senderEmployeeId: args.senderEmployeeId,
    receiverEmployeeId: args.receiverEmployeeId ?? args.senderEmployeeId,
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

export async function appendDashboardActionMessage(args: {
  env: OperatorAgentEnv;
  threadId: string;
  companyId?: string;
  senderEmployeeId: string;
  subject?: string;
  body: string;
  type?: "task" | "escalation" | "coordination";
  responseActionType: string;
  responseActionStatus: "requested" | "applied" | "rejected";
  causedStateTransition: boolean;
  relatedTaskId?: string;
  relatedApprovalId?: string;
  relatedEscalationId?: string;
}): Promise<string> {
  const store = getTaskStore(args.env);
  const messageId = newId("msg");

  await store.createMessage({
    id: messageId,
    threadId: args.threadId,
    companyId: args.companyId ?? "company_internal_aep",
    senderEmployeeId: args.senderEmployeeId,
    receiverEmployeeId: args.senderEmployeeId,
    type: args.type ?? "coordination",
    status: "acknowledged",
    source: "dashboard",
    subject: args.subject,
    body: args.body,
    payload: {},
    requiresResponse: false,
    responseActionType: args.responseActionType,
    responseActionStatus: args.responseActionStatus,
    causedStateTransition: args.causedStateTransition,
    relatedTaskId: args.relatedTaskId,
    relatedApprovalId: args.relatedApprovalId,
    relatedEscalationId: args.relatedEscalationId,
  });

  return messageId;
}