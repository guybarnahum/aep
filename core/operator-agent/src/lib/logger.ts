export function logInfo(message: string, data?: unknown): void {
  if (typeof data === "undefined") {
    console.log(`[operator-agent] ${message}`);
    return;
  }

  console.log(`[operator-agent] ${message}`, data);
}
