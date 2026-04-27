/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const api = readFileSync(resolve(process.cwd(), "apps/dashboard/src/api.ts"), "utf8");
const render = readFileSync(resolve(process.cwd(), "apps/dashboard/src/render.ts"), "utf8");
const main = readFileSync(resolve(process.cwd(), "apps/dashboard/src/main.ts"), "utf8");

assert(api.includes("/agent/staffing/role-gaps"), "Dashboard must read staffing gaps from canonical API");
assert(api.includes("/agent/staffing/requests"), "Dashboard must read staffing requests from canonical API");
assert(render.includes("renderStaffingDashboard"), "Dashboard must render staffing section");
assert(render.includes("create-staffing-request-from-gap"), "Dashboard must expose request-from-gap trigger");
assert(render.includes("approve-staffing-request"), "Dashboard must expose approval trigger");
assert(render.includes("cancel-staffing-request"), "Dashboard must expose cancel trigger");
assert(render.includes("fulfill-staffing-request"), "Dashboard must expose fulfillment trigger");
assert(main.includes("createStaffingRequest"), "Dashboard action must call canonical staffing request API");
assert(main.includes("updateStaffingRequestStatus"), "Dashboard action must call canonical request status API");
assert(main.includes("fulfillStaffingRequest"), "Dashboard action must call canonical fulfillment API");
assert(!main.includes('localStorage.setItem("staffing'), "Dashboard must not own staffing state");
assert(!render.includes("employees_catalog"), "Dashboard must not directly reference employee tables");

console.log("pr18-staffing-dashboard-contract-check passed");