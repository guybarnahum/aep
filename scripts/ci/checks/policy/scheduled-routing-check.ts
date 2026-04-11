// Inlined from core/operator-agent/src/triggers/scheduled.ts to avoid pulling
// in @aep/operator-agent/* path aliases that are only resolved by the worker's
// own tsconfig (not available to the root tsx runner in CI).
const WORKER_CRON = "* * * * *";
const MANAGER_CRON = "*/5 * * * *";

type ScheduledCronKind = "worker" | "manager" | "unknown";

function classifyScheduledCron(cron: string): ScheduledCronKind {
  if (cron === WORKER_CRON) return "worker";
  if (cron === MANAGER_CRON) return "manager";
  return "unknown";
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
    classifyScheduledCron(MANAGER_CRON) === "manager",
    `Expected ${MANAGER_CRON} to classify as manager`
  );

  assert(
    classifyScheduledCron("0 * * * *") === "unknown",
    "Expected unrelated cron to classify as unknown"
  );

  console.log("scheduled-routing-check passed", {
    workerCron: WORKER_CRON,
    managerCron: MANAGER_CRON,
  });
}

main();
