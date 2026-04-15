export async function sendSlackMirror(args: {
  webhookUrl: string;
  channelId: string;
  text: string;
}): Promise<{ ok: true; externalMessageId?: string } | { ok: false; code: string; reason: string }> {
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

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      code: "slack_request_failed",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}