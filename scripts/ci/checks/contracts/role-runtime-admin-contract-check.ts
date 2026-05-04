/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const route = read("core/operator-agent/src/routes/role-runtime-admin.ts");
const roleStore = read("core/operator-agent/src/persistence/d1/role-catalog-store-d1.ts");
const index = read("core/operator-agent/src/index.ts");
const protectionMap = read("core/operator-agent/src/routes/route-protection-map.ts");
const dashboardApi = read("apps/dashboard/src/api.ts");
const dashboardMain = read("apps/dashboard/src/main.ts");
const dashboardRender = read("apps/dashboard/src/render.ts");

assert(roleStore.includes("updateRoleRuntimeCapability"), "Missing canonical role runtime update helper");
assert(route.includes("getImplementationBindingExecutor"), "Role runtime admin must validate implementation bindings");
assert(route.includes("implementationBinding is required when runtimeEnabled=true"), "Enabling runtime must require a binding");
assert(index.includes("/agent/roles") && index.includes("role-runtime-admin"), "Role runtime route must be wired");
assert(protectionMap.includes("/agent/roles/*/runtime"), "Role runtime route must be classified in route-protection-map");
assert(protectionMap.includes("admin_runtime"), "Role runtime route must be admin_runtime");
assert(dashboardApi.includes("updateRoleRuntimeCapability"), "Dashboard API must expose role runtime update");
assert(dashboardRender.includes("edit-role-runtime"), "Dashboard must render role runtime edit action");
assert(dashboardMain.includes("handleEditRoleRuntime"), "Dashboard must handle role runtime edit action");

console.log("role-runtime-admin-contract-check passed");
