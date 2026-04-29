import { readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, needle: string): void {
  if (!read(path).includes(needle)) {
    throw new Error(`${path} missing required provider-adapter contract: ${needle}`);
  }
}

function assertNotContains(path: string, needle: string): void {
  if (read(path).includes(needle)) {
    throw new Error(`${path} contains forbidden provider-adapter pattern: ${needle}`);
  }
}

assertContains("core/operator-agent/src/product/provider-adapters.ts", "stateOwnership: \"aep\"");
assertContains("core/operator-agent/src/product/provider-adapters.ts", "GitHub adapter is not configured");
assertContains("core/operator-agent/src/product/provider-adapters.ts", "Cloudflare adapter is not configured");
assertContains("core/operator-agent/src/routes/product-deployments.ts", "status: \"in_progress\"");
assertContains("core/operator-agent/src/routes/product-deployments.ts", "status: \"deployed\"");
assertContains("core/operator-agent/src/routes/product-deployments.ts", "status: \"failed\"");
assertContains("core/operator-agent/src/routes/product-deployments.ts", "Provider state remains evidence only");
assertContains("core/operator-agent/src/index.ts", "/execute");
assertContains("core/operator-agent/src/routes/product-deployments.ts", "requireApprovedDeploymentApproval");

assertNotContains("apps/dashboard/src/api.ts", "/execute");
assertNotContains("apps/dashboard/src/render.ts", "Execute deployment");

console.log("provider adapter contract passed");
