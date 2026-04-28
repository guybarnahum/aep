/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const migration = readFileSync(
  resolve(
    process.cwd(),
    "infra/cloudflare/d1/operator-agent-migrations/0039_staffing_request_fulfillment.sql",
  ),
  "utf8",
);
const fulfillment = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/hr/staffing-fulfillment.ts"),
  "utf8",
);
const route = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/routes/staffing-request-fulfill.ts"),
  "utf8",
);
const index = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/index.ts"),
  "utf8",
);

assert(migration.includes("fulfilled_employee_id"), "Fulfillment migration must link employee");
assert(fulfillment.includes("createEmployee"), "Fulfillment must use canonical employee creation");
assert(fulfillment.includes("Only approved staffing requests can be fulfilled"), "Fulfillment must require approved request");
assert(fulfillment.includes("linkStaffingRequestFulfillment"), "Fulfillment must link request to employee");
assert(fulfillment.includes("Fulfilled staffing request"), "Fulfillment must publish canonical fulfillment message when possible");
assert(route.includes("fulfilledByEmployeeId"), "Fulfillment route must require actor identity");
assert(index.includes("/agent/staffing/requests"), "Staffing routes must remain wired");
assert(index.includes("/fulfill"), "Fulfillment route must be wired");

console.log("hiring-employee-linkage-contract-check passed");
