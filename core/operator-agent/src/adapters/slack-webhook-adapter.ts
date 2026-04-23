import type { MirrorTransportFailure, MirrorTransportSuccess } from "./types";
import { newToken } from "@aep/shared";

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
      body: JSON.stringify({
        channel: args.channelId,
        text: args.text,
      }),
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