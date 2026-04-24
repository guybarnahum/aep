import { getConfig } from "@aep/operator-agent/config";
import { isCronFallbackEnabled } from "@aep/operator-agent/lib/fallback-config";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";
import { handleWorkerCron } from "./cron";
import { handleManagerCron } from "./manager-cron";
import { handleTeamCron } from "./team-cron";

export const WORKER_CRON = "* * * * *";
export const TEAM_CRON = "*/2 * * * *";
export const MANAGER_CRON = "*/5 * * * *";

export type ScheduledCronKind = "worker" | "manager" | "team" | "unknown";

export function classifyScheduledCron(cron: string): ScheduledCronKind {
  if (cron === WORKER_CRON) {
    return "worker";
  }

  if (cron === TEAM_CRON) {
    return "team";
  }

  if (cron === MANAGER_CRON) {
    return "manager";
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

      if (shouldRunMinuteInterval(scheduledTimeMs, config.teamTickIntervalMinutes)) {
        console.log("[operator-agent] invoking team cron via worker tick", {
          scheduledTimeMs,
          intervalMinutes: config.teamTickIntervalMinutes,
        });
        await handleTeamCron(env);
      }

      if (shouldRunMinuteInterval(scheduledTimeMs, config.managerTickIntervalMinutes)) {
        console.log("[operator-agent] invoking manager cron via worker tick", {
          scheduledTimeMs,
          intervalMinutes: config.managerTickIntervalMinutes,
        });
        await handleManagerCron(env);
      }

      return;
    }
    case "manager": {
      console.log("[operator-agent] invoking manager cron as fallback/bootstrap");
      await handleManagerCron(env);
      return;
    }
    case "team": {
      console.log("[operator-agent] invoking team cron as fallback/bootstrap");
      await handleTeamCron(env);
      return;
    }
    default:
      console.log("[operator-agent] ignoring unknown cron trigger", { cron });
  }
}
