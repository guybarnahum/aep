import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export function isCronFallbackEnabled(env?: OperatorAgentEnv): boolean {
  return String(env?.AEP_CRON_FALLBACK_ENABLED ?? "true") === "true";
}
