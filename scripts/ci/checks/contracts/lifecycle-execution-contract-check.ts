import { readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, needle: string): void {
  if (!read(path).includes(needle)) {
    throw new Error(`${path} missing PR25 lifecycle execution contract: ${needle}`);
  }
}

function assertNotContains(path: string, needle: string): void {
  if (read(path).includes(needle)) {
    throw new Error(`${path} violates PR25 lifecycle execution contract: ${needle}`);
  }
}

assertContains(
  "core/operator-agent/src/lib/store-types.ts",
  "applyApprovedProjectLifecycleTransition",
);
assertContains(
  "core/operator-agent/src/persistence/d1/task-store-d1.ts",
  "applyApprovedProjectLifecycleTransition",
);
assertContains("core/operator-agent/src/routes/product-lifecycle.ts", "handleExecuteProductLifecycleAction");
assertContains("core/operator-agent/src/routes/product-lifecycle.ts", 'approval.status !== "approved"');
assertContains("core/operator-agent/src/routes/product-lifecycle.ts", "markExecuted");
assertContains("core/operator-agent/src/routes/product-lifecycle.ts", "stateChanged: true");
assertContains("core/operator-agent/src/index.ts", "lifecycle-actions\\/execute");

for (const forbidden of [
  "project.status =",
  "setProjectStatus",
  "updateProjectStatus",
]) {
  assertNotContains("core/operator-agent/src/routes/product-lifecycle.ts", forbidden);
}

console.log("PR25 lifecycle execution contract passed");
