import { isCronFallbackEnabled } from "@aep/operator-agent/lib/fallback-config";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";
import { handleWorkerCron } from "./cron";
import { handleManagerCron } from "./manager-cron";

export const WORKER_CRON = "* * * * *";
export const MANAGER_CRON = "*/5 * * * *";

export type ScheduledCronKind = "worker" | "manager" | "unknown";

export function classifyScheduledCron(cron: string): ScheduledCronKind {
  if (cron === WORKER_CRON) {
    return "worker";
  }

  if (cron === MANAGER_CRON) {
    return "manager";
  }

  return "unknown";
}

export async function handleScheduledCron(
  cron: string,
  env: OperatorAgentEnv
): Promise<void> {
  if (!isCronFallbackEnabled(env)) {
    console.log("[operator-agent] cron fallback disabled; skipping scheduled execution", {
      cron,
      kind: classifyScheduledCron(cron),
    });
    return;
  }

  console.log("[operator-agent] scheduled trigger received (cron fallback path)", {
    cron,
    kind: classifyScheduledCron(cron),
  });

  switch (classifyScheduledCron(cron)) {
    case "worker": {
      console.log("[operator-agent] invoking worker cron as fallback/bootstrap");
      await handleWorkerCron(env);
      return;
    }
    case "manager": {
      console.log("[operator-agent] invoking manager cron as fallback/bootstrap");
      await handleManagerCron(env);
      return;
    }
    default:
      console.log("[operator-agent] ignoring unknown cron trigger", { cron });
  }
}
