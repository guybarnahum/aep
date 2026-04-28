import { readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, needle: string): void {
  if (!read(path).includes(needle)) {
    throw new Error(`${path} missing PR23 signal contract: ${needle}`);
  }
}

function assertNotContains(path: string, needle: string): void {
  if (read(path).includes(needle)) {
    throw new Error(`${path} violates PR23 signal contract: ${needle}`);
  }
}

assertContains("core/operator-agent/src/product/product-signal-contracts.ts", "validation");
assertContains("core/operator-agent/src/product/product-signal-contracts.ts", "monitoring");
assertContains(
  "core/operator-agent/src/product/product-signal-contracts.ts",
  "customer_intake",
);
assertContains("core/operator-agent/src/product/product-signal-contracts.ts", 'route: "intake"');
assertContains("core/operator-agent/src/product/product-signal-contracts.ts", 'route: "thread"');

assertContains("core/operator-agent/src/routes/product-signals.ts", "handleIngestProductSignal");
assertContains("core/operator-agent/src/routes/product-signals.ts", "createIntakeRequest");
assertContains("core/operator-agent/src/routes/product-signals.ts", "createMessageThread");
assertContains("core/operator-agent/src/routes/product-signals.ts", "createMessage");
assertContains(
  "core/operator-agent/src/routes/product-signals.ts",
  "directTaskCreationAllowed: false",
);
assertContains("core/operator-agent/src/index.ts", '"/agent/product-signals"');

for (const forbidden of [
  "createTask(",
  "createTaskWithDependencies(",
  "updateTaskStatus(",
  "createProductExecutionGraph(",
  "handleCreateProductExecutionGraph(",
  "updateProductDeploymentStatus(",
]) {
  assertNotContains("core/operator-agent/src/routes/product-signals.ts", forbidden);
}

console.log("signal-ingest-contract-check passed");
