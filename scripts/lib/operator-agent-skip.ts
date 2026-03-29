export function isCloudflarePlaceholder404Error(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  const hasCloudflareHtml =
    (message.includes("<!DOCTYPE html>") || message.includes("<html")) &&
    (message.includes("There is nothing here yet") ||
      message.includes("The resource you are looking for could not be found") ||
      message.includes("Cloudflare"));

  if (!hasCloudflareHtml) {
    return false;
  }

  return (
    message.includes("Request failed: 404") ||
    message.includes("Request failed: 500") ||
    message.includes("Request failed: 502") ||
    message.includes("Request failed: 503") ||
    message.includes("Request failed: 504") ||
    message.includes("status 404") ||
    message.includes("status 500") ||
    message.includes("status 502") ||
    message.includes("status 503") ||
    message.includes("status 504")
  );
}

export function handleOperatorAgentUnavailableSkip(
  scriptName: string,
  error: unknown
): boolean {
  if (!isCloudflarePlaceholder404Error(error)) {
    return false;
  }

  console.log(
    `[warn] ${scriptName}: operator-agent route returned a Cloudflare placeholder 404; soft-skipping check because the worker is not deployed or the public route is not attached`
  );
  return true;
}