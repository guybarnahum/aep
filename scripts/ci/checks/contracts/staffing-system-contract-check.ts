/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const contracts = read("core/operator-agent/src/hr/staffing-contracts.ts");
const gapDetection = read("core/operator-agent/src/hr/staffing-gap-detection.ts");
const requests = read("core/operator-agent/src/routes/staffing-requests.ts");
const fulfillment = read("core/operator-agent/src/hr/staffing-fulfillment.ts");
const dashboard = read("apps/dashboard/src/main.ts");

// --- Contract presence ---
assert(contracts.includes("JobDescriptionContract"), "Missing JobDescription contract");
assert(contracts.includes("StaffingRequestContract"), "Missing StaffingRequest contract");
assert(contracts.includes("HiringRecommendationContract"), "Missing HiringRecommendation contract");
assert(contracts.includes("RoleGapContract"), "Missing RoleGap contract");

// --- Lifecycle correctness ---
assert(
  contracts.includes('"draft"')
    && contracts.includes('"submitted"')
    && contracts.includes('"approved"')
    && contracts.includes('"fulfilled"'),
  "StaffingRequest lifecycle incomplete",
);

// --- No direct employee mutation outside lifecycle ---
assert(
  !requests.includes("createEmployee("),
  "Staffing request routes must not create employees",
);

assert(
  fulfillment.includes("createEmployee("),
  "Fulfillment must create employees through canonical lifecycle",
);

// --- Gap detection must be advisory ---
assert(
  gapDetection.includes("advisoryOnly: true"),
  "Gap detection must remain advisory",
);

assert(
  !gapDetection.includes("createEmployee("),
  "Gap detection must not create employees",
);

assert(
  !gapDetection.includes("fulfillStaffingRequest"),
  "Gap detection must not trigger hiring",
);

// --- Dashboard must not own state ---
assert(
  !dashboard.includes("localStorage.setItem(\"staffing"),
  "Dashboard must not persist staffing state",
);

// --- Canonical routes must exist ---
const index = read("core/operator-agent/src/index.ts");

assert(index.includes("/agent/staffing/role-gaps"), "Missing role gaps route");
assert(index.includes("/agent/staffing/requests"), "Missing staffing requests route");
assert(index.includes("staffingRequestFulfillMatch"), "Missing fulfillment route matcher");
assert(index.includes("handleFulfillStaffingRequest("), "Missing fulfillment route handler");

// --- No bypass of staffing -> employee creation ---
const employeeRoutes = read("core/operator-agent/src/routes/employees.ts");
assert(
  !employeeRoutes.includes("staffingRequestId"),
  "Employee creation must not depend on staffing request outside fulfillment path",
);

// --- No adapter ownership of staffing state ---
const adapters = read("core/operator-agent/src/adapters/external-collaboration-contract.ts");
assert(
  !adapters.includes("staffing_requests"),
  "Adapters must not own staffing state",
);

// --- CI-generated artifacts must remain purgeable ---
const cleanup = read("scripts/ci/checks/scenarios/cleanup-canonical-artifacts.ts");
const ciMarkers = read("scripts/ci/shared/ci-artifacts.ts");
assert(
  cleanup.includes("/agent/te/purge-ci-artifacts"),
  "CI cleanup must target canonical CI artifact purge endpoint",
);
assert(
  ciMarkers.includes("__ci"),
  "CI artifact marker must include __ci payload metadata for purge targeting",
);

console.log("staffing-system-contract-check passed");