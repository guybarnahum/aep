import type { TaskStore } from "@aep/operator-agent/lib/store-types";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

import { sendEmailMirror } from "./email-adapter";
import { resolveMirrorTargets } from "./mirror-routing-policy";
import { sendSlackMirror } from "./slack-webhook-adapter";
import type { MirrorChannel, MirrorDeliveryRecord, MirrorDispatchInput, MirrorTarget } from "./types";

function renderSlackMirrorText(input: MirrorDispatchInput): string {
  const lines = [
    `AEP mirror from ${input.senderEmployeeId}`,
    `Thread: ${input.threadId}`,
  ];

  if (input.routing.taskId) {
    lines.push(`Task: ${input.routing.taskId}`);
  }

  if (input.subject) {
    lines.push(`Subject: ${input.subject}`);
  }

  lines.push(`Message: ${input.body}`);
  return lines.join("\n");
}

function renderEmailMirrorSubject(input: MirrorDispatchInput): string {
  return input.subject ?? `AEP mirror from ${input.senderEmployeeId} (${input.threadId})`;
}

function renderEmailMirrorBody(input: MirrorDispatchInput): string {
  const lines = [
    `AEP mirror from ${input.senderEmployeeId}`,
    `Thread: ${input.threadId}`,
  ];

  if (input.routing.taskId) {
    lines.push(`Task: ${input.routing.taskId}`);
  }

  lines.push("", input.body);
  return lines.join("\n");
}

function deliveryId(messageId: string, channel: MirrorChannel, target: string): string {
  const suffix = crypto.randomUUID().split("-")[0];
  return `mdl_${messageId}_${channel}_${target.replace(/[^a-zA-Z0-9_-]/g, "_")}_${suffix}`;
}

function buildDeliveryRecord(args: {
  messageId: string;
  threadId: string;
  channel: MirrorChannel;
  target: string;
  status: MirrorDeliveryRecord["status"];
  externalMessageId?: string;
  failureCode?: string;
  failureReason?: string;
  createdAt: string;
}): MirrorDeliveryRecord {
  return {
    id: deliveryId(args.messageId, args.channel, args.target),
    messageId: args.messageId,
    threadId: args.threadId,
    channel: args.channel,
    target: args.target,
    status: args.status,
    externalMessageId: args.externalMessageId,
    failureCode: args.failureCode,
    failureReason: args.failureReason,
    createdAt: args.createdAt,
  };
}

function unresolvedFailureChannel(input: MirrorDispatchInput): MirrorChannel {
  return input.routing.messageType === "escalation" ? "email" : "slack";
}

function unresolvedFailureTarget(channel: MirrorChannel): string {
  return channel === "email" ? "unresolved_email_group" : "unresolved_slack_channel";
}

async function dispatchToTarget(args: {
  env: OperatorAgentEnv;
  target: MirrorTarget;
  input: MirrorDispatchInput;
}): Promise<MirrorDeliveryRecord> {
  const createdAt = new Date().toISOString();

  if (args.target.kind === "slack") {
    const result = await sendSlackMirror({
      webhookUrl: args.env.SLACK_MIRROR_WEBHOOK_URL ?? "",
      channelId: args.target.channelId,
      text: renderSlackMirrorText(args.input),
    });

    if (result.ok) {
      return buildDeliveryRecord({
        messageId: args.input.messageId,
        threadId: args.input.threadId,
        channel: "slack",
        target: args.target.channelId,
        status: "delivered",
        externalMessageId: result.externalMessageId,
        createdAt,
      });
    }

    return buildDeliveryRecord({
      messageId: args.input.messageId,
      threadId: args.input.threadId,
      channel: "slack",
      target: args.target.channelId,
      status: "failed",
      failureCode: result.code,
      failureReason: result.reason,
      createdAt,
    });
  }

  const result = await sendEmailMirror({
    recipientGroup: args.target.recipientGroup,
    subject: renderEmailMirrorSubject(args.input),
    body: renderEmailMirrorBody(args.input),
  });

  if (result.ok) {
    return buildDeliveryRecord({
      messageId: args.input.messageId,
      threadId: args.input.threadId,
      channel: "email",
      target: args.target.recipientGroup,
      status: "delivered",
      externalMessageId: result.externalMessageId,
      createdAt,
    });
  }

  return buildDeliveryRecord({
    messageId: args.input.messageId,
    threadId: args.input.threadId,
    channel: "email",
    target: args.target.recipientGroup,
    status: "failed",
    failureCode: result.code,
    failureReason: result.reason,
    createdAt,
  });
}

export async function dispatchMessageMirrors(args: {
  env: OperatorAgentEnv;
  store: Pick<TaskStore, "createMessageMirrorDelivery">;
  input: MirrorDispatchInput;
}): Promise<void> {
  const targets = resolveMirrorTargets(args.env, args.input.routing);

  if (targets.length === 0) {
    const channel = unresolvedFailureChannel(args.input);
    await args.store.createMessageMirrorDelivery(
      buildDeliveryRecord({
        messageId: args.input.messageId,
        threadId: args.input.threadId,
        channel,
        target: unresolvedFailureTarget(channel),
        status: "failed",
        failureCode: "mirror_target_unresolved",
        failureReason: "Mirror routing resolved no human-visible targets",
        createdAt: new Date().toISOString(),
      }),
    );
    return;
  }

  for (const target of targets) {
    const delivery = await dispatchToTarget({
      env: args.env,
      target,
      input: args.input,
    });

    await args.store.createMessageMirrorDelivery(delivery);
  }
}