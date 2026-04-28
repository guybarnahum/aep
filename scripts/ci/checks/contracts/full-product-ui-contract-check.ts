import { readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, needle: string): void {
  if (!read(path).includes(needle)) {
    throw new Error(`${path} missing PR21B full product UI contract: ${needle}`);
  }
}

function assertNotContains(path: string, needle: string): void {
  if (read(path).includes(needle)) {
    throw new Error(`${path} violates PR21B read-only UI contract: ${needle}`);
  }
}

assertContains("apps/dashboard/src/render.ts", "Artifact browser");
assertContains("apps/dashboard/src/render.ts", "Deployment panel");
assertContains("apps/dashboard/src/render.ts", "Repository mirror");
assertContains("apps/dashboard/src/render.ts", "Decision timeline");
assertContains("apps/dashboard/src/render.ts", "Read-only canonical deployment records");
assertContains("apps/dashboard/src/render.ts", "UI does not execute deployments");
assertContains("apps/dashboard/src/render.ts", "GitHub does not own AEP state");

assertContains("apps/dashboard/src/types.ts", "sourceTaskId: string");
assertContains("apps/dashboard/src/types.ts", "deploymentTarget: Record<string, unknown>");
assertContains("apps/dashboard/src/types.ts", "| \"parked\"");

assertNotContains("apps/dashboard/src/api.ts", "/product-deployments/:id/execute");
assertNotContains("apps/dashboard/src/api.ts", "/execute");
assertNotContains("apps/dashboard/src/render.ts", "Execute deployment");
assertNotContains("apps/dashboard/src/render.ts", "Deploy now");

console.log("PR21B full product UI contract passed");
