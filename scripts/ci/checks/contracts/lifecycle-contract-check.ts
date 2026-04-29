import { readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, needle: string): void {
  if (!read(path).includes(needle)) {
    throw new Error(`${path} missing lifecycle contract: ${needle}`);
  }
}

function assertNotContains(path: string, needle: string): void {
  if (read(path).includes(needle)) {
    throw new Error(`${path} violates lifecycle contract: ${needle}`);
  }
}

assertContains("core/operator-agent/src/product/product-lifecycle-contracts.ts", "\"pause\"");
assertContains("core/operator-agent/src/product/product-lifecycle-contracts.ts", "\"resume\"");
assertContains("core/operator-agent/src/product/product-lifecycle-contracts.ts", "\"retire\"");
assertContains("core/operator-agent/src/product/product-lifecycle-contracts.ts", "\"transition\"");
assertContains("core/operator-agent/src/product/product-lifecycle-contracts.ts", "lifecycleTargetStatus");

assertContains("core/operator-agent/src/routes/product-lifecycle.ts", "handleRequestProductLifecycleAction");
assertContains("core/operator-agent/src/routes/product-lifecycle.ts", "getApprovalStore");
assertContains("core/operator-agent/src/routes/product-lifecycle.ts", "createMessageThread");
assertContains("core/operator-agent/src/routes/product-lifecycle.ts", "createMessage");
assertContains("core/operator-agent/src/routes/product-lifecycle.ts", "createTask");
assertContains("core/operator-agent/src/routes/product-lifecycle.ts", "directProjectStatusMutationAllowed: false");
assertContains("core/operator-agent/src/routes/product-lifecycle.ts", "stateChanged: false");
assertContains("core/operator-agent/src/index.ts", "/lifecycle-actions");

for (const forbidden of [
  "updateProjectStatus",
  "setProjectStatus",
  "project.status =",
  "UPDATE projects SET status",
]) {
  assertNotContains("core/operator-agent/src/routes/product-lifecycle.ts", forbidden);
}

console.log("lifecycle contract passed");
