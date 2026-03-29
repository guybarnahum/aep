export function isCloudflarePlaceholder404Error(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("Request failed: 404") &&
    (message.includes("<!DOCTYPE html>") || message.includes("<html")) &&
    (message.includes("There is nothing here yet") ||
      message.includes("The resource you are looking for could not be found") ||
      message.includes("Cloudflare"))
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