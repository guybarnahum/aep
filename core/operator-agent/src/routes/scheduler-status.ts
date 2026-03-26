import { isCronFallbackEnabled } from "@aep/operator-agent/lib/fallback-config";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleSchedulerStatus(
  _request: Request,
  env?: OperatorAgentEnv
): Promise<Response> {
  return Response.json({
    primaryScheduler: "paperclip",
    cronFallbackEnabled: isCronFallbackEnabled(env),
  });
}
