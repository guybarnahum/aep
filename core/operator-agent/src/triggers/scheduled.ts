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

      const teamIntervalGate = shouldRunMinuteInterval(scheduledTimeMs, cadence.teamTickIntervalMinutes);
      console.log("[operator-agent] team interval gate evaluation", {
        minute,
        interval: cadence.teamTickIntervalMinutes,
        pass: teamIntervalGate,
        modulo: minute % cadence.teamTickIntervalMinutes,
      });
      if (teamIntervalGate) {
        console.log("[operator-agent] invoking team cron via interval gate", {
          minute,
          interval: cadence.teamTickIntervalMinutes,
          source: cadence.source,
        });
        await handleTeamCron(env);
      }

      const managerIntervalGate = shouldRunMinuteInterval(scheduledTimeMs, cadence.managerTickIntervalMinutes);
      console.log("[operator-agent] manager interval gate evaluation", {
        minute,
        interval: cadence.managerTickIntervalMinutes,
        pass: managerIntervalGate,
        modulo: minute % cadence.managerTickIntervalMinutes,
      });
      if (managerIntervalGate) {
        console.log("[operator-agent] invoking manager cron via interval gate", {
          minute,
          interval: cadence.managerTickIntervalMinutes,
          source: cadence.source,
        });
        try {
          await handleManagerCron(env);
          console.log("[operator-agent] manager cron completed successfully");
        } catch (managerError) {
          console.error("[operator-agent] manager cron failed", {
            error: managerError instanceof Error ? managerError.message : String(managerError),
            stack: managerError instanceof Error ? managerError.stack : undefined,
          });
          throw managerError;
        }
      }

      return;
    }
    default:
      console.log("[operator-agent] ignoring unknown cron trigger", { cron });
  }
}
