import { readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, needle: string): void {
  if (!read(path).includes(needle)) {
    throw new Error(`${path} missing manual tutorial readiness contract: ${needle}`);
  }
}

assertContains("apps/dashboard/src/api.ts", "/agent/intake");
assertContains("apps/dashboard/src/api.ts", "/convert-to-project");
assertContains("apps/dashboard/src/api.ts", "/agent/approvals/approve");
assertContains("apps/dashboard/src/api.ts", "/agent/approvals/reject");
assertContains("apps/dashboard/src/api.ts", "/execute");
assertContains("apps/dashboard/src/api.ts", "/lifecycle-actions");
assertContains("apps/dashboard/src/api.ts", "/lifecycle-actions/execute");
assertContains("apps/dashboard/src/api.ts", "/agent/product-signals");

assertContains("apps/dashboard/src/render.ts", "Manual tutorial controls");
assertContains("apps/dashboard/src/render.ts", "Tutorial intake flow");
assertContains("apps/dashboard/src/render.ts", "Deployment controls");
assertContains("apps/dashboard/src/render.ts", "Lifecycle controls");
assertContains("apps/dashboard/src/render.ts", "Signal simulation");

assertContains("apps/dashboard/src/main.ts", "attachTutorialIntakeHandlers");
assertContains("apps/dashboard/src/main.ts", "attachManualTutorialControlHandlers");

console.log("manual-tutorial-readiness-contract-check passed");
