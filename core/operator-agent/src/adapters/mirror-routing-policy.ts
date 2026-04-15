import type { OperatorAgentEnv } from "@aep/operator-agent/types";

import type { MirrorRoutingInput, MirrorTarget } from "./types";

function isApprovalRouted(input: MirrorRoutingInput): boolean {
  const subject = input.subject?.toLowerCase() ?? "";
  const taskType = input.taskType?.toLowerCase() ?? "";
  return input.threadType === "approval" || taskType.includes("approval") || subject.includes("approval");
}

function isEscalationRouted(input: MirrorRoutingInput): boolean {
  const subject = input.subject?.toLowerCase() ?? "";
  const taskType = input.taskType?.toLowerCase() ?? "";
  return (
    input.messageType === "escalation" ||
    input.threadType === "escalation" ||
    taskType.includes("escalat") ||
    subject.includes("escalat")
  );
}

export function resolveMirrorTargets(
  env: Pick<
    OperatorAgentEnv,
    | "MIRROR_DEFAULT_SLACK_CHANNEL"
    | "MIRROR_APPROVALS_SLACK_CHANNEL"
    | "MIRROR_ESCALATIONS_SLACK_CHANNEL"
    | "MIRROR_ESCALATIONS_EMAIL_GROUP"
  >,
  input: MirrorRoutingInput,
): MirrorTarget[] {
  if (!input.humanVisibilityRequired) {
    return [];
  }

  const targets: MirrorTarget[] = [];

  if (isApprovalRouted(input)) {
    if (env.MIRROR_APPROVALS_SLACK_CHANNEL) {
      targets.push({ kind: "slack", channelId: env.MIRROR_APPROVALS_SLACK_CHANNEL });
    }
    return targets;
  }

  if (isEscalationRouted(input)) {
    if (env.MIRROR_ESCALATIONS_SLACK_CHANNEL) {
      targets.push({ kind: "slack", channelId: env.MIRROR_ESCALATIONS_SLACK_CHANNEL });
    }
    if (env.MIRROR_ESCALATIONS_EMAIL_GROUP) {
      targets.push({ kind: "email", recipientGroup: env.MIRROR_ESCALATIONS_EMAIL_GROUP });
    }
    return targets;
  }

  if (env.MIRROR_DEFAULT_SLACK_CHANNEL) {
    targets.push({ kind: "slack", channelId: env.MIRROR_DEFAULT_SLACK_CHANNEL });
  }

  return targets;
}