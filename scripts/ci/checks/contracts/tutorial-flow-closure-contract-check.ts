import { readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, needle: string): void {
  if (!read(path).includes(needle)) {
    throw new Error(`${path} missing tutorial flow closure contract: ${needle}`);
  }
}

assertContains("apps/dashboard/src/api.ts", "/agent/product-deployments");
assertContains("apps/dashboard/src/api.ts", "createProductDeploymentRecord");
assertContains("apps/dashboard/src/api.ts", "ProductDeploymentCreateResponse");

assertContains("apps/dashboard/src/render.ts", "Tutorial flow progress");
assertContains("apps/dashboard/src/render.ts", "renderTutorialFlowProgress");
assertContains("apps/dashboard/src/render.ts", "getReadyDeploymentCandidates");
assertContains("apps/dashboard/src/render.ts", "create-deployment-record");
assertContains("apps/dashboard/src/render.ts", "deployment_candidate");
assertContains("apps/dashboard/src/render.ts", "tutorial-flow-grid");

assertContains("apps/dashboard/src/main.ts", "createProductDeploymentRecord");
assertContains("apps/dashboard/src/main.ts", "create-deployment-record");

assertContains("apps/dashboard/src/types.ts", "ProductDeploymentCreateResponse");
assertContains("apps/dashboard/src/types.ts", "TutorialFlowStepState");

if (read("apps/dashboard/src/render.ts").includes("placeholder=\"Artifact ID\"") &&
    !read("apps/dashboard/src/render.ts").includes("create-deployment-record")) {
  throw new Error("Tutorial flow closure: create-deployment-record form with artifact selector must be present");
}

console.log("tutorial-flow-closure-contract-check passed");
