/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const route = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/routes/customer-intake.ts"),
  "utf8",
);

for (const required of [
  "parseExternalSurfaceKind",
  "getExternalSurfaceContract",
  "submit_intake",
  "external_surface",
  "createIntakeRequest",
  "createMessageThread",
  "createMessage",
  "No project, task, approval, deployment, employee, or staffing state was mutated directly",
]) {
  assert(route.includes(required), `Missing customer intake invariant: ${required}`);
}

for (const forbidden of [
  "createProject(",
  "createTask(",
  "createProductDeployment(",
  "createProductDeployment",
  "createArtifact(",
]) {
  assert(
    !route.includes(forbidden),
    `Customer intake route must not directly call ${forbidden}`,
  );
}

const index = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/index.ts"),
  "utf8",
);
assert(
  index.includes("/agent/customer-intake"),
  "Operator-agent must expose customer intake route",
);

const storeTypes = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/lib/store-types.ts"),
  "utf8",
);
for (const field of [
  "externalSurfaceKind",
  "productSurface",
  "sourceUrl",
  "idempotencyKey",
  "customerContact",
]) {
  assert(storeTypes.includes(field), `IntakeRequest must include ${field}`);
}

const migration = readFileSync(
  resolve(process.cwd(), "infra/cloudflare/d1/operator-agent-migrations/0040_customer_intake_metadata.sql"),
  "utf8",
);
assert(
  migration.includes("ALTER TABLE intake_requests"),
  "PR19E must extend canonical intake_requests",
);
assert(
  migration.includes("idempotency_key"),
  "Customer intake must support idempotency",
);

console.log("customer-intake-flow-contract-check passed");
