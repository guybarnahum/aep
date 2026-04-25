/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const indexSourcePath = resolve(process.cwd(), "core/operator-agent/src/index.ts");
const tasksRoutePath = resolve(process.cwd(), "core/operator-agent/src/routes/tasks.ts");
const storeTypesPath = resolve(process.cwd(), "core/operator-agent/src/lib/store-types.ts");
const taskStorePath = resolve(process.cwd(), "core/operator-agent/src/persistence/d1/task-store-d1.ts");

const indexSource = readFileSync(indexSourcePath, "utf8");
const tasksRouteSource = readFileSync(tasksRoutePath, "utf8");
const storeTypesSource = readFileSync(storeTypesPath, "utf8");
const taskStoreSource = readFileSync(taskStorePath, "utf8");

assert(
  indexSource.includes("taskParkMatch")
    && indexSource.includes("handleParkTask")
    && indexSource.includes("tasks\\/([^/]+)\\/park"),
  "Expected dispatch route for POST /agent/tasks/:taskId/park",
);
assert(
  tasksRouteSource.includes("export async function handleParkTask"),
  "Expected handleParkTask route handler",
);
assert(
  tasksRouteSource.includes("managerDecisionId"),
  "Expected park route to require managerDecisionId",
);
assert(
  storeTypesSource.includes("managerDecisionId: string;"),
  "Expected TaskStore.parkTask contract to require managerDecisionId",
);
assert(
  taskStoreSource.includes("parkTask requires managerDecisionId"),
  "Expected D1 parkTask to enforce managerDecisionId",
);
assert(
  taskStoreSource.includes("kind: \"task_parked\""),
  "Expected D1 parkTask to write canonical task park audit message",
);

console.log("task-parking-contract-check passed", {
  indexSourcePath,
  tasksRoutePath,
  storeTypesPath,
  taskStorePath,
});
