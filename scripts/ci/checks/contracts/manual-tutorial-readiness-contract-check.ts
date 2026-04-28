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
assertContains("apps/dashboard/src/render.ts", "decide-deployment-approval");
assertContains("apps/dashboard/src/render.ts", "decide-lifecycle-approval");
assertContains("apps/dashboard/src/render.ts", "No deployment approvals found");
assertContains("apps/dashboard/src/render.ts", "No deployment records yet");
assertContains("apps/dashboard/src/render.ts", "targetState");
assertContains("apps/dashboard/src/render.ts", "value=\"reject\"");

assertContains("apps/dashboard/src/main.ts", "attachTutorialIntakeHandlers");
assertContains("apps/dashboard/src/main.ts", "attachManualTutorialControlHandlers");
assertContains("apps/dashboard/src/main.ts", "rejectApproval");
assertContains("apps/dashboard/src/main.ts", "targetState:");

if (read("apps/dashboard/src/render.ts").includes("placeholder=\"Approval ID\"")) {
  throw new Error("Product deployment approval control must not use a generic free-form Approval ID input");
}

console.log("manual-tutorial-readiness-contract-check passed");
