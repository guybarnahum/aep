import { readFileSync } from "node:fs";

const providerSource = readFileSync(
  "core/operator-agent/src/product/provider-adapters.ts",
  "utf8",
);
const routeSource = readFileSync(
  "core/operator-agent/src/routes/product-deployments.ts",
  "utf8",
);
const indexSource = readFileSync("core/operator-agent/src/index.ts", "utf8");
const dashboardApi = readFileSync("apps/dashboard/src/api.ts", "utf8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

for (const required of [
  "https://api.github.com",
  "ensureGitHubRepository",
  "upsertGitHubFiles",
  "https://api.cloudflare.com/client/v4",
  "ensureCloudflarePagesProject",
  "createCloudflarePagesDirectUpload",
  "putCloudflareWorkerScript",
  'stateOwnership: "aep"',
]) {
  assert(providerSource.includes(required), `provider-adapters.ts missing ${required}`);
}

assert(
  indexSource.includes("/execute") &&
    routeSource.includes("updateProductDeploymentStatus") &&
    routeSource.includes("Provider state remains evidence only"),
  "Product deployment execution must remain canonical-route owned",
);

// The dashboard may proxy execution requests to the operator-agent
// (executeProductDeployment, executeProductLifecycleAction) — those are
// legitimate operator-panel calls. What it must never do is implement
// provider execution itself (direct GitHub/Cloudflare calls).
for (const forbidden of [
  "executeProviderDeployment",
  "https://api.github.com",
  "https://api.cloudflare.com",
]) {
  assert(!dashboardApi.includes(forbidden), `Dashboard must not execute deployments: ${forbidden}`);
}

console.log("provider-real-execution-contract-check passed");