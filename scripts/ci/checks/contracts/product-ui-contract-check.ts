import { readFileSync } from "node:fs";

function assertContains(file: string, needle: string): void {
  const text = readFileSync(file, "utf8");
  if (!text.includes(needle)) {
    throw new Error(`${file} missing required PR21A contract: ${needle}`);
  }
}

function assertNotContains(file: string, needle: string): void {
  const text = readFileSync(file, "utf8");
  if (text.includes(needle)) {
    throw new Error(`${file} contains forbidden PR21A UI ownership pattern: ${needle}`);
  }
}

assertContains("apps/dashboard/src/api.ts", "/agent/projects?limit=100");
assertContains("apps/dashboard/src/api.ts", "Boolean(project.initiativeKind)");
assertContains("apps/dashboard/src/api.ts", "/product-visibility");
assertContains("apps/dashboard/src/api.ts", "summary: ProductVisibilitySummary");
assertContains("apps/dashboard/src/api.ts", "return payload.summary;");
assertContains("apps/dashboard/src/api.ts", "/interventions");
assertContains("apps/dashboard/src/main.ts", "product-initiatives");
assertContains("apps/dashboard/src/render.ts", "Read-only dependency view");
assertContains("apps/dashboard/src/render.ts", "Provider execution belongs to PR20");
assertContains("apps/dashboard/src/render.ts", "summary.tasks.active");
assertContains("apps/dashboard/src/render.ts", "summary.artifacts.deployable");
assertContains("apps/dashboard/src/render.ts", "summary.deployments.latest");
assertContains("apps/dashboard/src/render.ts", "summary.decisions.recent");

assertNotContains("apps/dashboard/src/api.ts", "/agent/product-deployments/");
assertNotContains("apps/dashboard/src/render.ts", "Deploy now");
assertNotContains("apps/dashboard/src/render.ts", "summary.activeTasks");
assertNotContains("apps/dashboard/src/render.ts", "summary.deployableArtifacts");
assertNotContains("apps/dashboard/src/render.ts", "summary.deploymentRecords");
assertNotContains("apps/dashboard/src/render.ts", "summary.recentMessages");

console.log("PR21A product UI contract passed");
