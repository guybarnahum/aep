import { getConfig } from "@aep/operator-agent/config";
import { isCronFallbackEnabled } from "@aep/operator-agent/lib/fallback-config";
import { getOperatorSchedulerCadence } from "@aep/operator-agent/lib/scheduler-state";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";
import { handleWorkerCron } from "./cron";
import { handleManagerCron } from "./manager-cron";
import { handleTeamCron } from "./team-cron";

export const WORKER_CRON = "* * * * *";

export type ScheduledCronKind = "worker" | "unknown";

export function classifyScheduledCron(cron: string): ScheduledCronKind {
  if (cron === WORKER_CRON) {
    return "worker";
  }

  return "unknown";
}

function shouldRunMinuteInterval(
  scheduledTimeMs: number,
  intervalMinutes: number,
): boolean {
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    return false;
  }

  return new Date(scheduledTimeMs).getUTCMinutes() % intervalMinutes === 0;
}

export async function handleScheduledCron(
  cron: string,
  env: OperatorAgentEnv,
  scheduledTimeMs = Date.now(),
): Promise<void> {
  const config = getConfig(env);
  const cadence = await getOperatorSchedulerCadence(env);

  if (!isCronFallbackEnabled(env)) {
    console.log("[operator-agent] cron fallback disabled; skipping scheduled execution", {
      cron,
      kind: classifyScheduledCron(cron),
      scheduledTimeMs,
    });
    return;
  }

  console.log("[operator-agent] scheduled trigger received (cron fallback path)", {
    cron,
    kind: classifyScheduledCron(cron),
    scheduledTimeMs,
  });

  switch (classifyScheduledCron(cron)) {
    case "worker": {
      console.log("[operator-agent] invoking worker cron as fallback/bootstrap");
      await handleWorkerCron(env, scheduledTimeMs);

      const minute = new Date(scheduledTimeMs).getUTCMinutes();

      if (shouldRunMinuteInterval(scheduledTimeMs, cadence.teamTickIntervalMinutes)) {
        console.log("[operator-agent] invoking team cron via interval gate", {
          minute,
          interval: cadence.teamTickIntervalMinutes,
          source: cadence.source,
        });
        await handleTeamCron(env);
      }

      if (shouldRunMinuteInterval(scheduledTimeMs, cadence.managerTickIntervalMinutes)) {
        console.log("[operator-agent] invoking manager cron via interval gate", {
          minute,
          interval: cadence.managerTickIntervalMinutes,
          source: cadence.source,
        });
        await handleManagerCron(env);
      }

      return;
    }
    default:
      console.log("[operator-agent] ignoring unknown cron trigger", { cron });
  }
}
