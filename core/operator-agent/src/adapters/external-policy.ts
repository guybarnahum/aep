import type { TaskStore } from "../lib/store-types";

export type ExternalInteractionDecision =
  | { ok: true }
  | { ok: false; reasonCode: string };

async function readThreadPolicy(store: TaskStore, threadId: string) {
  return store.getThreadExternalInteractionPolicy(threadId);
}

export async function authorizeInboundExternalReply(args: {
  store: TaskStore;
  threadId: string;
  channel: "slack" | "email";
  externalActorId?: string;
  target?: string;
}): Promise<ExternalInteractionDecision> {
  const policy = await readThreadPolicy(args.store, args.threadId);

  if (policy && !policy.inboundRepliesAllowed) {
    return { ok: false, reasonCode: "external_replies_disabled" };
  }

  if (policy?.allowedChannels && !policy.allowedChannels.includes(args.channel)) {
    return { ok: false, reasonCode: "external_channel_not_allowed" };
  }

  if (
    policy?.allowedTargets &&
    (!args.target || !policy.allowedTargets.includes(args.target))
  ) {
    return { ok: false, reasonCode: "external_target_not_allowed" };
  }

  if (
    policy?.allowedExternalActors &&
    (!args.externalActorId || !policy.allowedExternalActors.includes(args.externalActorId))
  ) {
    return { ok: false, reasonCode: "external_actor_not_allowed" };
  }

  return { ok: true };
}

export async function authorizeExternalAction(args: {
  store: TaskStore;
  threadId: string;
  channel: "slack" | "email";
  externalActorId: string;
  actionType: string;
}): Promise<ExternalInteractionDecision> {
  const policy = await readThreadPolicy(args.store, args.threadId);

  if (policy && !policy.externalActionsAllowed) {
    return { ok: false, reasonCode: "external_actions_disabled" };
  }

  if (policy?.allowedChannels && !policy.allowedChannels.includes(args.channel)) {
    return { ok: false, reasonCode: "external_channel_not_allowed" };
  }

  if (
    policy?.allowedExternalActors &&
    !policy.allowedExternalActors.includes(args.externalActorId)
  ) {
    return { ok: false, reasonCode: "external_actor_not_allowed" };
  }

  const thread = await args.store.getMessageThread(args.threadId);

  if (!thread) {
    return { ok: false, reasonCode: "thread_not_found" };
  }

  if (args.actionType.startsWith("approval_") && !thread.relatedApprovalId) {
    return { ok: false, reasonCode: "external_action_thread_mismatch" };
  }

  if (args.actionType.startsWith("escalation_") && !thread.relatedEscalationId) {
    return { ok: false, reasonCode: "external_action_thread_mismatch" };
  }

  return { ok: true };
}