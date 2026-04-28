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

assertContains("apps/dashboard/src/api.ts", "/agent/projects?initiativeKind=");
assertContains("apps/dashboard/src/api.ts", "/product-visibility");
assertContains("apps/dashboard/src/api.ts", "/interventions");
assertContains("apps/dashboard/src/main.ts", "product-initiatives");
assertContains("apps/dashboard/src/render.ts", "Read-only dependency view");
assertContains("apps/dashboard/src/render.ts", "Provider execution belongs to PR20");

assertNotContains("apps/dashboard/src/api.ts", "/agent/product-deployments/");
assertNotContains("apps/dashboard/src/render.ts", "Deploy now");

console.log("PR21A product UI contract passed");
