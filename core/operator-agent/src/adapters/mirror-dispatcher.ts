import type { TaskStore } from "@aep/operator-agent/lib/store-types";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";
import { newToken } from "@aep/shared";
import { resolveMirrorRoutes, type MirrorRoutingContext } from "../lib/mirror-routing";

import { sendEmailMirror } from "./email-adapter";
import { sendSlackMirror } from "./slack-webhook-adapter";
import type {
  ExternalMessageProjection,
  ExternalThreadProjection,
  MirrorChannel,
  MirrorDeliveryRecord,
  MirrorDispatchInput,
  MirrorTarget,
} from "./types";

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
  const suffix = newToken();
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

function targetKey(target: MirrorTarget): { channel: MirrorChannel; target: string } {
  if (target.kind === "slack") {
    return { channel: "slack", target: target.channelId };
  }

  return { channel: "email", target: target.recipientGroup };
}

function buildRoutingContext(input: MirrorDispatchInput): MirrorRoutingContext {
  const isEscalation =
    input.routing.threadType === "escalation" ||
    input.routing.messageType === "escalation";

  return {
    threadKind: input.routing.threadType ?? input.routing.messageType,
    messageType: input.routing.messageType,
    severity: isEscalation ? "critical" : undefined,
    visibility: input.routing.humanVisibilityRequired ? "human_visible" : undefined,
  };
}

function syntheticExternalThreadId(args: {
  channel: MirrorChannel;
  target: string;
  threadId: string;
}): string {
  return `${args.channel}-thread:${args.target}:${args.threadId}`;
}

function threadProjectionId(threadId: string, channel: MirrorChannel, target: string): string {
  return `etp_${threadId}_${channel}_${target.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function messageProjectionId(messageId: string, channel: MirrorChannel, target: string): string {
  return `emp_${messageId}_${channel}_${target.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

async function dispatchToTarget(args: {
  env: OperatorAgentEnv;
  target: MirrorTarget;
  externalThreadId?: string;
  input: MirrorDispatchInput;
}): Promise<
  | {
      ok: true;
      channel: MirrorChannel;
      target: string;
      externalThreadId: string;
      externalMessageId: string;
      createdAt: string;
    }
  | {
      ok: false;
      delivery: MirrorDeliveryRecord;
    }
> {
  const createdAt = new Date().toISOString();

  if (args.target.kind === "slack") {
    const result = await sendSlackMirror({
      webhookUrl: args.env.SLACK_MIRROR_WEBHOOK_URL ?? "",
      channelId: args.target.channelId,
      text: renderSlackMirrorText(args.input),
      externalThreadId: args.externalThreadId,
    });

    if (result.ok) {
      return {
        ok: true,
        channel: "slack",
        target: args.target.channelId,
        externalThreadId: result.externalThreadId,
        externalMessageId: result.externalMessageId,
        createdAt,
      };
    }

    if (result.code === "slack_webhook_missing") {
      return {
        ok: false,
        delivery: buildDeliveryRecord({
          messageId: args.input.messageId,
          threadId: args.input.threadId,
          channel: "slack",
          target: args.target.channelId,
          status: "skipped",
          failureCode: "slack_adapter_not_configured",
          failureReason: result.reason,
          createdAt,
        }),
      };
    }

    return {
      ok: false,
      delivery: buildDeliveryRecord({
        messageId: args.input.messageId,
        threadId: args.input.threadId,
        channel: "slack",
        target: args.target.channelId,
        status: "failed",
        failureCode: result.code,
        failureReason: result.reason,
        createdAt,
      }),
    };
  }

  const result = await sendEmailMirror({
    recipientGroup: args.target.recipientGroup,
    subject: renderEmailMirrorSubject(args.input),
    body: renderEmailMirrorBody(args.input),
    externalThreadId: args.externalThreadId,
  });

  if (result.ok) {
    return {
      ok: true,
      channel: "email",
      target: args.target.recipientGroup,
      externalThreadId: result.externalThreadId,
      externalMessageId: result.externalMessageId,
      createdAt,
    };
  }

  if (result.code === "email_not_configured") {
    return {
      ok: false,
      delivery: buildDeliveryRecord({
        messageId: args.input.messageId,
        threadId: args.input.threadId,
        channel: "email",
        target: args.target.recipientGroup,
        status: "skipped",
        failureCode: "email_adapter_not_implemented",
        failureReason: result.reason,
        createdAt,
      }),
    };
  }

  return {
    ok: false,
    delivery: buildDeliveryRecord({
      messageId: args.input.messageId,
      threadId: args.input.threadId,
      channel: "email",
      target: args.target.recipientGroup,
      status: "failed",
      failureCode: result.code,
      failureReason: result.reason,
      createdAt,
    }),
  };
}

export async function dispatchMessageMirrors(args: {
  env: OperatorAgentEnv;
  store: Pick<
    TaskStore,
    | "createMessageMirrorDelivery"
    | "getExternalThreadProjection"
    | "createExternalThreadProjection"
    | "createExternalMessageProjection"
  >;
  input: MirrorDispatchInput;
}): Promise<void> {
  const resolved = await resolveMirrorRoutes(
    args.env,
    buildRoutingContext(args.input),
  );

  for (const skipped of resolved.skipped) {
    await args.store.createMessageMirrorDelivery(
      buildDeliveryRecord({
        messageId: args.input.messageId,
        threadId: args.input.threadId,
        channel: skipped.targetAdapter,
        target: skipped.targetKey,
        status: "skipped",
        failureCode: skipped.reason,
        failureReason: `Mirror delivery skipped: missing configuration for ${skipped.targetKey}`,
        createdAt: new Date().toISOString(),
      }),
    );
  }

  if (resolved.routes.length === 0) {
    if (resolved.skipped.length > 0) {
      return;
    }

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

  for (const route of resolved.routes) {
    const target: MirrorTarget =
      route.targetAdapter === "slack"
        ? { kind: "slack", channelId: route.targetValue }
        : { kind: "email", recipientGroup: route.targetValue };
    const routingTarget = targetKey(target);
    const existingThreadProjection = await args.store.getExternalThreadProjection({
      threadId: args.input.threadId,
      channel: routingTarget.channel,
      target: routingTarget.target,
    });

    const dispatchResult = await dispatchToTarget({
      env: args.env,
      target,
      externalThreadId:
        existingThreadProjection?.externalThreadId ??
        syntheticExternalThreadId({
          channel: routingTarget.channel,
          target: routingTarget.target,
          threadId: args.input.threadId,
        }),
      input: args.input,
    });

    if (!dispatchResult.ok) {
      await args.store.createMessageMirrorDelivery(dispatchResult.delivery);
      continue;
    }

    if (!existingThreadProjection) {
      const threadProjection: ExternalThreadProjection = {
        id: threadProjectionId(args.input.threadId, dispatchResult.channel, dispatchResult.target),
        threadId: args.input.threadId,
        channel: dispatchResult.channel,
        target: dispatchResult.target,
        externalThreadId: dispatchResult.externalThreadId,
        createdAt: dispatchResult.createdAt,
        updatedAt: dispatchResult.createdAt,
      };

      await args.store.createExternalThreadProjection(threadProjection);
    }

    const messageProjection: ExternalMessageProjection = {
      id: messageProjectionId(args.input.messageId, dispatchResult.channel, dispatchResult.target),
      messageId: args.input.messageId,
      threadId: args.input.threadId,
      channel: dispatchResult.channel,
      target: dispatchResult.target,
      externalThreadId: dispatchResult.externalThreadId,
      externalMessageId: dispatchResult.externalMessageId,
      createdAt: dispatchResult.createdAt,
    };

    await args.store.createExternalMessageProjection(messageProjection);
    await args.store.createMessageMirrorDelivery(
      buildDeliveryRecord({
        messageId: args.input.messageId,
        threadId: args.input.threadId,
        channel: dispatchResult.channel,
        target: dispatchResult.target,
        status: "delivered",
        externalMessageId: dispatchResult.externalMessageId,
        createdAt: dispatchResult.createdAt,
      }),
    );
  }
}