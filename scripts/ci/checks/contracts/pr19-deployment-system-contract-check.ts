/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const migration = readFileSync(
  resolve(process.cwd(), "infra/cloudflare/d1/operator-agent-migrations/0039_product_deployment_records.sql"),
  "utf8",
);
assert(
  migration.includes("CREATE TABLE IF NOT EXISTS product_deployment_records"),
  "PR19C must create product_deployment_records",
);
assert(
  migration.includes("source_artifact_id") && migration.includes("approval_id"),
  "Deployment records must link source artifact and approval",
);

const route = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/routes/product-deployments.ts"),
  "utf8",
);
for (const required of [
  "deployment_candidate",
  "ready_for_deployment",
  "stateOwnership",
  "external_safe deployments require approvalId",
  "No external deployment has been executed by this route",
]) {
  assert(route.includes(required), `Missing deployment route invariant: ${required}`);
}

const index = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/index.ts"),
  "utf8",
);
assert(
  index.includes("/agent/product-deployments"),
  "Operator-agent must expose product deployment routes",
);

const storeTypes = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/lib/store-types.ts"),
  "utf8",
);
assert(
  storeTypes.includes("ProductDeploymentRecord") &&
    storeTypes.includes("ProductDeploymentStatus"),
  "Store types must define product deployment records",
);

const d1Store = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/persistence/d1/task-store-d1.ts"),
  "utf8",
);
for (const method of [
  "createProductDeployment",
  "getProductDeployment",
  "listProductDeployments",
  "updateProductDeploymentStatus",
]) {
  assert(d1Store.includes(method), `D1 store must implement ${method}`);
}

console.log("pr19-deployment-system-contract-check passed");
