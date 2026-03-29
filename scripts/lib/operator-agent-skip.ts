export type OperatorAgentSoftSkipKind =
  | "not_deployed_or_unrouted"
  | "rate_limited_or_quota_limited"
  | "cloudflare_edge_error";

export type OperatorAgentInfraClassification =
  | { softSkip: true; kind: OperatorAgentSoftSkipKind; message: string }
  | { softSkip: false };

function extractStatus(message: string): number | undefined {
  const match =
    /Request failed: (\d{3})/.exec(message) ??
    /status[: ]+(\d{3})/.exec(message) ??
    /\b(\d{3})\b/.exec(message);
  if (match) {
    return Number(match[1]);
  }
  return undefined;
}

function hasCloudflareHtmlBody(message: string): boolean {
  const hasHtml =
    message.includes("<!DOCTYPE html") || message.includes("<html");
  if (!hasHtml) {
    return false;
  }
  return (
    message.includes("Cloudflare") ||
    message.includes("There is nothing here yet") ||
    message.includes("The resource you are looking for could not be found") ||
    message.includes("<!--[if lt IE 7]>") ||
    message.includes("oldie")
  );
}

function hasRateLimitSignal(message: string): boolean {
  return (
    message.includes("429") ||
    message.toLowerCase().includes("rate limit") ||
    message.toLowerCase().includes("rate-limit") ||
    message.toLowerCase().includes("quota") ||
    message.toLowerCase().includes("too many requests")
  );
}

export function classifyOperatorAgentInfraError(
  error: unknown
): OperatorAgentInfraClassification {
  const message = error instanceof Error ? error.message : String(error);
  const status = extractStatus(message);
  const isCloudflareHtml = hasCloudflareHtmlBody(message);
  const isRateLimit = hasRateLimitSignal(message);

  if (status === 429 || isRateLimit) {
    return {
      softSkip: true,
      kind: "rate_limited_or_quota_limited",
      message: `operator-agent write/test path appears rate-limited or quota-limited (status ${status ?? "unknown"}); read-only surface may still be healthy`,
    };
  }

  if (isCloudflareHtml && status === 404) {
    return {
      softSkip: true,
      kind: "not_deployed_or_unrouted",
      message: `operator-agent route returned a Cloudflare placeholder 404; worker is not deployed or the public route is not attached`,
    };
  }

  if (
    isCloudflareHtml &&
    (status === 500 || status === 502 || status === 503 || status === 504)
  ) {
    return {
      softSkip: true,
      kind: "cloudflare_edge_error",
      message: `operator-agent returned a Cloudflare edge error (status ${status}); edge may be degraded`,
    };
  }

  return { softSkip: false };
}

export function handleOperatorAgentSoftSkip(
  scriptName: string,
  error: unknown
): boolean {
  const classification = classifyOperatorAgentInfraError(error);
  if (!classification.softSkip) {
    return false;
  }

  switch (classification.kind) {
    case "not_deployed_or_unrouted":
      console.warn(
        `[warn] ${scriptName}: ${classification.message}; soft-skipping check`
      );
      break;
    case "rate_limited_or_quota_limited":
      console.warn(
        `[warn] ${scriptName}: ${classification.message}; soft-skipping check — this is a soft infrastructure issue on the operator-agent write/test path, not a read-surface outage`
      );
      break;
    case "cloudflare_edge_error":
      console.warn(
        `[warn] ${scriptName}: ${classification.message}; soft-skipping check`
      );
      break;
  }

  return true;
}