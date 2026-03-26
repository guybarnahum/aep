import {
  MANAGER_CRON,
  WORKER_CRON,
  classifyScheduledCron,
} from "../../core/operator-agent/src/triggers/scheduled";

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
