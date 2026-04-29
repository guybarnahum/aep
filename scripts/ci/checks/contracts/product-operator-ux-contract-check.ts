import { readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, needle: string): void {
  if (!read(path).includes(needle)) {
    throw new Error(`${path} missing product operator UX contract: ${needle}`);
  }
}

function assertNotContains(path: string, needle: string): void {
  if (read(path).includes(needle)) {
    throw new Error(`${path} contains forbidden tutorial-specific UI marker: ${needle}`);
  }
}

assertContains("apps/dashboard/src/render.ts", "Product flow progress");
assertContains("apps/dashboard/src/render.ts", "Product operator controls");
assertContains("apps/dashboard/src/render.ts", "Validation and monitoring");
assertContains("apps/dashboard/src/render.ts", "External mirrors");
assertContains("apps/dashboard/src/render.ts", "Staffing and blockers");
assertContains("apps/dashboard/src/render.ts", "renderProductSignalPanel");
assertContains("apps/dashboard/src/render.ts", "renderProductExternalMirrorPanel");
assertContains("apps/dashboard/src/render.ts", "renderProductStaffingAndBlockerPanel");
assertContains("apps/dashboard/src/render.ts", "Modify requirements");
assertContains("apps/dashboard/src/render.ts", "Request redesign");
assertContains("apps/dashboard/src/render.ts", "Add constraint");

assertContains("apps/dashboard/src/main.ts", "attachProductIntakeHandlers");
assertContains("apps/dashboard/src/main.ts", "attachProductOperatorControlHandlers");

for (const forbidden of [
  "Tutorial intake flow",
  "Manual tutorial controls",
  "renderTutorialFlowProgress",
  "attachTutorialIntakeHandlers",
  "attachManualTutorialControlHandlers",
  "dashboard_tutorial",
]) {
  assertNotContains("apps/dashboard/src/render.ts", forbidden);
  assertNotContains("apps/dashboard/src/main.ts", forbidden);
}

console.log("product-operator-ux-contract-check passed");
