/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const detectorSource = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/hr/staffing-gap-detection.ts"),
  "utf8",
);

const routeSource = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/routes/staffing-role-gaps.ts"),
  "utf8",
);

const indexSource = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/index.ts"),
  "utf8",
);

assert(detectorSource.includes("advisoryOnly: true"), "Gap detection must be advisory-only");
assert(detectorSource.includes("listRoleCatalog"), "Gap detection must inspect role catalog");
assert(detectorSource.includes("listEmployeeCatalog"), "Gap detection must inspect employees");
assert(detectorSource.includes("getTaskStore"), "Gap detection must inspect tasks");
assert(detectorSource.includes("directEmployeeMutationAllowed: false"), "Role gaps must deny direct employee mutation");
assert(detectorSource.includes("parallelHrDatabaseAllowed: false"), "Role gaps must deny parallel HR database");
assert(!detectorSource.includes("createEmployee("), "Gap detection must not create employees");
assert(!detectorSource.includes("applyEmployeeLifecycleAction"), "Gap detection must not mutate lifecycle");
assert(routeSource.includes("request.method !== \"GET\""), "Role gaps route must be read-only GET");
assert(indexSource.includes("/agent/staffing/role-gaps"), "Role gaps route must be wired");

console.log("staffing-gap-detection-contract-check passed");
