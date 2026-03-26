import type { OperatorAgentEnv } from "@aep/operator-agent/types";

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
  console.log("[operator-agent] scheduled trigger received (cron fallback path)", {
    cron,
    kind: classifyScheduledCron(cron),
  });

  switch (classifyScheduledCron(cron)) {
    case "worker": {
      console.log("[operator-agent] invoking worker cron as fallback/bootstrap");
      const { handleWorkerCron } = await import("@aep/operator-agent/triggers/cron");
      await handleWorkerCron(env);
      return;
    }
    case "manager": {
      console.log("[operator-agent] invoking manager cron as fallback/bootstrap");
      const { handleManagerCron } = await import("@aep/operator-agent/triggers/manager-cron");
      await handleManagerCron(env);
      return;
    }
    default:
      console.log("[operator-agent] ignoring unknown cron trigger", { cron });
  }
}
