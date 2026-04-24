// Inlined from core/operator-agent/src/triggers/scheduled.ts to avoid pulling
// in @aep/operator-agent/* path aliases that are only resolved by the worker's
// own tsconfig (not available to the root tsx runner in CI).
const WORKER_CRON = "* * * * *";
const TEAM_CRON = "*/2 * * * *";
const MANAGER_CRON = "*/5 * * * *";
const DEFAULT_TEAM_TICK_INTERVAL_MINUTES = 2;
const DEFAULT_MANAGER_TICK_INTERVAL_MINUTES = 5;

type ScheduledCronKind = "worker" | "manager" | "team" | "unknown";

function classifyScheduledCron(cron: string): ScheduledCronKind {
  if (cron === WORKER_CRON) return "worker";
  if (cron === TEAM_CRON) return "team";
  if (cron === MANAGER_CRON) return "manager";
  return "unknown";
}

function shouldRunMinuteInterval(
  minute: number,
  intervalMinutes: number,
): boolean {
  return minute % intervalMinutes === 0;
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function main(): void {
  assert(
    classifyScheduledCron(WORKER_CRON) === "worker",
    `Expected ${WORKER_CRON} to classify as worker`
  );

  assert(
    classifyScheduledCron(TEAM_CRON) === "team",
    `Expected ${TEAM_CRON} to classify as team`
  );

  assert(
    classifyScheduledCron(MANAGER_CRON) === "manager",
    `Expected ${MANAGER_CRON} to classify as manager`
  );

  assert(
    shouldRunMinuteInterval(10, DEFAULT_TEAM_TICK_INTERVAL_MINUTES),
    "Expected team cadence to run on minute 10 with the default 2-minute interval"
  );

  assert(
    !shouldRunMinuteInterval(11, DEFAULT_TEAM_TICK_INTERVAL_MINUTES),
    "Expected team cadence to skip minute 11 with the default 2-minute interval"
  );

  assert(
    shouldRunMinuteInterval(15, DEFAULT_MANAGER_TICK_INTERVAL_MINUTES),
    "Expected manager cadence to run on minute 15 with the default 5-minute interval"
  );

  assert(
    !shouldRunMinuteInterval(16, DEFAULT_MANAGER_TICK_INTERVAL_MINUTES),
    "Expected manager cadence to skip minute 16 with the default 5-minute interval"
  );

  assert(
    shouldRunMinuteInterval(12, 3) && !shouldRunMinuteInterval(13, 3),
    "Expected cadence checks to remain configurable for non-default intervals"
  );

  assert(
    classifyScheduledCron("0 * * * *") === "unknown",
    "Expected unrelated cron to classify as unknown"
  );

  console.log("scheduled-routing-check passed", {
    workerCron: WORKER_CRON,
    teamCron: TEAM_CRON,
    managerCron: MANAGER_CRON,
    teamTickIntervalMinutes: DEFAULT_TEAM_TICK_INTERVAL_MINUTES,
    managerTickIntervalMinutes: DEFAULT_MANAGER_TICK_INTERVAL_MINUTES,
  });
}

main();
