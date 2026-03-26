import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export function isPaperclipAuthRequired(env?: OperatorAgentEnv): boolean {
  return String(env?.PAPERCLIP_AUTH_REQUIRED ?? "false") === "true";
}

export function validatePaperclipAuth(
  request: Request,
  env?: OperatorAgentEnv
): void {
  if (!isPaperclipAuthRequired(env)) {
    return;
  }

  const configured = env?.PAPERCLIP_SHARED_SECRET;
  if (!configured) {
    throw new Error(
      "Paperclip auth is required but PAPERCLIP_SHARED_SECRET is not configured"
    );
  }

  const provided = request.headers.get("x-paperclip-shared-secret");
  if (!provided || provided !== configured) {
    throw new Error("Invalid Paperclip authentication");
  }
}
