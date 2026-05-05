import { readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const warnings: string[] = [];

function assertContains(path: string, needle: string): void {
  if (!read(path).includes(needle)) {
    warnings.push(`WARN: ${path} missing required provider-adapter contract: ${needle}`);
  }
}

function assertNotContains(path: string, needle: string): void {
  if (read(path).includes(needle)) {
    warnings.push(`WARN: ${path} contains forbidden provider-adapter pattern: ${needle}`);
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

// The dashboard may proxy /execute requests to the operator-agent (approval-gated
// tutorial flow). What it must not do is call provider APIs directly.
assertNotContains("apps/dashboard/src/api.ts", "executeProviderDeployment");
assertNotContains("apps/dashboard/src/api.ts", "https://api.github.com");
assertNotContains("apps/dashboard/src/api.ts", "https://api.cloudflare.com");

if (warnings.length > 0) {
  for (const w of warnings) console.warn(w);
  console.warn(`provider adapter contract: ${warnings.length} warning(s)`);
} else {
  console.log("provider adapter contract passed");
}
