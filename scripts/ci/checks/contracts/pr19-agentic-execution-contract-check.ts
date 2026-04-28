/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const executionLoop = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/product/product-execution-loop.ts"),
  "utf8",
);

for (const taskType of [
  "web_design",
  "web_implementation",
  "test_execution",
  "deployment",
  "verification",
  "monitoring_setup",
]) {
  assert(
    executionLoop.includes(`taskType: "${taskType}"`),
    `Product execution graph must create ${taskType}`,
  );
}

for (const required of [
  "createTaskWithDependencies",
  "TEAM_WEB_PRODUCT",
  "TEAM_VALIDATION",
  "TEAM_INFRA",
  "createMessageThread",
  "createMessage",
  "product_execution_graph_created",
]) {
  assert(executionLoop.includes(required), `Missing execution-loop invariant: ${required}`);
}

const route = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/routes/product-execution.ts"),
  "utf8",
);

for (const required of [
  "createdByEmployeeId is required",
  "Product execution graph can only be created for product initiative projects",
  "createProductExecutionGraph",
]) {
  assert(route.includes(required), `Missing product execution route invariant: ${required}`);
}

const index = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/index.ts"),
  "utf8",
);
assert(
  index.includes("/product-execution"),
  "Operator-agent must expose project product-execution route",
);

const intakeConvert = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/routes/intake-convert.ts"),
  "utf8",
);

for (const required of [
  "initiativeKind",
  "productSurface",
  "externalVisibility",
  "bootstrapProductInitiativeTasks",
]) {
  assert(
    intakeConvert.includes(required),
    `Intake conversion must support product initiative field ${required}`,
  );
}

for (const forbidden of [
  "deployableArtifactKind",
  "createProductDeployment(",
  "createArtifact(",
]) {
  assert(
    !executionLoop.includes(forbidden),
    `PR19F must not directly create artifacts or deployments: ${forbidden}`,
  );
}

console.log("pr19-agentic-execution-contract-check passed");