import type { MirrorTransportFailure, MirrorTransportSuccess } from "./types";
import { newToken } from "@aep/shared";

export type SlackMirrorPayload = {
  channel: string;
  text: string;
  thread_ts?: string;
};

function isSlackTimestamp(value: string): boolean {
  return /^\d{10}\.\d{6}$/.test(value);
}

function resolveSlackThreadTs(externalThreadId?: string): string | undefined {
  if (!externalThreadId) {
    return undefined;
  }

  if (externalThreadId.startsWith("slack-ts:")) {
    const candidate = externalThreadId.slice("slack-ts:".length);
    return isSlackTimestamp(candidate) ? candidate : undefined;
  }

  return isSlackTimestamp(externalThreadId) ? externalThreadId : undefined;
}

export function buildSlackMirrorPayload(args: {
  channelId: string;
  text: string;
  externalThreadId?: string;
}): SlackMirrorPayload {
  const channel = args.channelId.trim();
  const text = args.text.trim();

  const payload: SlackMirrorPayload = {
    channel,
    text,
  };

  const threadTs = resolveSlackThreadTs(args.externalThreadId);
  if (threadTs) {
    payload.thread_ts = threadTs;
  }

  return payload;
}

export async function sendSlackMirror(args: {
  webhookUrl: string;
  channelId: string;
  text: string;
  externalThreadId?: string;
}): Promise<MirrorTransportSuccess | MirrorTransportFailure> {
  if (!args.webhookUrl || args.webhookUrl.trim().length === 0) {
    return {
      ok: false,
      code: "slack_webhook_missing",
      reason: "SLACK_MIRROR_WEBHOOK_URL is not configured",
    };
  }

  try {
    const response = await fetch(args.webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(
        buildSlackMirrorPayload({
          channelId: args.channelId,
          text: args.text,
          externalThreadId: args.externalThreadId,
        }),
      ),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        ok: false,
        code: `slack_http_${response.status}`,
        reason: body || `Slack webhook request failed with status ${response.status}`,
      };
    }

    return {
      ok: true,
      externalThreadId:
        args.externalThreadId ?? `slack-thread:${args.channelId}:${newToken()}`,
      externalMessageId: `slack-message:${args.channelId}:${newToken(24)}`,
    };
  } catch (error) {
    return {
      ok: false,
      code: "slack_request_failed",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}