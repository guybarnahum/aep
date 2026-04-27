/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const migration = readFileSync(
  resolve(process.cwd(), "infra/cloudflare/d1/operator-agent-migrations/0038_staffing_requests.sql"),
  "utf8",
);
const store = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/persistence/d1/staffing-request-store-d1.ts"),
  "utf8",
);
const routes = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/routes/staffing-requests.ts"),
  "utf8",
);
const index = readFileSync(resolve(process.cwd(), "core/operator-agent/src/index.ts"), "utf8");

for (const state of ["draft", "submitted", "approved", "fulfilled", "rejected", "canceled"]) {
  assert(migration.includes(state), `Migration must include lifecycle state ${state}`);
  assert(store.includes(state), `Store must include lifecycle state ${state}`);
}

assert(migration.includes("staffing_requests"), "Migration must create staffing_requests table");
assert(store.includes("directEmployeeMutationAllowed: false"), "Store output must deny direct employee mutation");
assert(store.includes("parallelHrDatabaseAllowed: false"), "Store output must deny parallel HR database");
assert(store.includes("POST /agent/employees"), "Store must preserve canonical employee creation boundary");
assert(routes.includes("validateRoleCatalogEntry"), "Routes must validate role/team ownership");
assert(routes.includes("approvedByEmployeeId is required"), "Approval must require approver identity");
assert(!routes.includes("createEmployee("), "Hiring request route must not create employees in PR18D");
assert(!store.includes("createEmployee("), "Hiring request store must not create employees in PR18D");
assert(index.includes("/agent/staffing/requests"), "Staffing request routes must be wired");

console.log("pr18-hiring-request-flow-contract-check passed");
