/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const summary = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/product/product-visibility-summary.ts"),
  "utf8",
);

for (const required of [
  "ProductVisibilitySummary",
  "project",
  "relatedCustomerIntake",
  "tasks",
  "artifacts",
  "deployments",
  "decisions",
  "interventions",
  "suggestedActions",
]) {
  assert(summary.includes(required), `Visibility summary missing ${required}`);
}

for (const method of [
  "getProject",
  "getIntakeRequest",
  "listIntakeRequests",
  "listTasks",
  "listArtifacts",
  "listProductDeployments",
  "listMessageThreads",
  "listMessages",
]) {
  assert(summary.includes(method), `Visibility summary must use ${method}`);
}

const visibilityRoute = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/routes/product-visibility.ts"),
  "utf8",
);
assert(
  visibilityRoute.includes("buildProductVisibilitySummary"),
  "Visibility route must build product visibility summary",
);

const interventionRoute = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/routes/product-interventions.ts"),
  "utf8",
);

for (const required of [
  "INTERVENTION_ACTIONS",
  "createMessageThread",
  "createMessage",
  "createTaskWithDependencies",
  "product_human_intervention",
  "source: \"human\"",
  "requiresResponse: true",
]) {
  assert(interventionRoute.includes(required), `Intervention route missing ${required}`);
}

for (const forbidden of [
  "createProductDeployment(",
  "createArtifact(",
  "updateProductDeploymentStatus(",
  "updateTaskStatus(",
]) {
  assert(
    !interventionRoute.includes(forbidden),
    `Human intervention must not directly mutate execution state: ${forbidden}`,
  );
}

const index = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/index.ts"),
  "utf8",
);

assert(
  index.includes("/product-visibility"),
  "Operator-agent must expose product visibility route",
);
assert(
  index.includes("/interventions"),
  "Operator-agent must expose product intervention route",
);

console.log("pr19-product-visibility-contract-check passed");