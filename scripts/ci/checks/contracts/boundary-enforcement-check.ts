/* eslint-disable no-console */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function walk(dir: string): string[] {
  const root = resolve(process.cwd(), dir);
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === ".wrangler") continue;
      out.push(...walk(path));
    } else if (path.endsWith(".ts") || path.endsWith(".tsx")) {
      out.push(path);
    }
  }
  return out;
}

const productDeployments = read("core/operator-agent/src/routes/product-deployments.ts");
for (const required of [
  "getApprovalStore",
  "requireApprovedDeploymentApproval",
  "approval.status !== \"approved\"",
  "external_safe deployments require an approved approval",
]) {
  assert(productDeployments.includes(required), `Deployment approval enforcement missing ${required}`);
}

const customerIntake = read("core/operator-agent/src/routes/customer-intake.ts");
for (const forbidden of [
  "createProject(",
  "createTask(",
  "createProductDeployment(",
  "createArtifact(",
  "updateProductDeploymentStatus(",
  "updateTaskStatus(",
]) {
  assert(
    !customerIntake.includes(forbidden),
    `Customer intake must not bypass canonical conversion/execution: ${forbidden}`,
  );
}

const intervention = read("core/operator-agent/src/routes/product-interventions.ts");
for (const forbidden of [
  "createProductDeployment(",
  "createArtifact(",
  "updateProductDeploymentStatus(",
  "updateTaskStatus(",
]) {
  assert(
    !intervention.includes(forbidden),
    `Human intervention must not directly mutate execution state: ${forbidden}`,
  );
}

const deploymentRouteFiles = walk("core/operator-agent/src/routes").filter((path) =>
  readFileSync(path, "utf8").includes("createProductDeployment(") ||
  readFileSync(path, "utf8").includes("updateProductDeploymentStatus("),
);

for (const path of deploymentRouteFiles) {
  assert(
    path.endsWith("product-deployments.ts"),
    `Only product-deployments route may mutate product deployment records: ${path}`,
  );
}

const artifactRouteFiles = walk("core/operator-agent/src/routes").filter((path) =>
  readFileSync(path, "utf8").includes("createArtifact("),
);

for (const path of artifactRouteFiles) {
  assert(
    path.endsWith("task-artifacts.ts") || path.endsWith("run.ts"),
    `Only task-artifacts and internal run route may create task artifacts: ${path}`,
  );
}

const productSources = walk("core/operator-agent/src/product");
for (const path of productSources) {
  const source = readFileSync(path, "utf8");
  if (path.endsWith("provider-adapters.ts")) {
    for (const required of [
      "stateOwnership: \"aep\"",
      "GitHub adapter is not configured",
      "Cloudflare adapter is not configured",
    ]) {
      assert(
        source.includes(required),
        `Provider adapter boundary missing ${required}: ${path}`,
      );
    }
    continue;
  }

  assert(
    !source.includes("wrangler") &&
      !source.includes("cloudflare") &&
      !source.includes("pages.dev") &&
      !source.includes("github.com"),
    `Product contract/runtime code must not directly implement provider deployment: ${path}`,
  );
}

const externalSurfaceContracts = read("core/operator-agent/src/product/external-surface-contracts.ts");
for (const required of [
  "externalStateOwnershipAllowed: false",
  "privateCognitionExposureAllowed: false",
  "directTaskMutationAllowed: false",
  "directApprovalMutationAllowed: false",
  "directDeploymentMutationAllowed: false",
  "assertNoDirectMutationRoutes",
]) {
  assert(
    externalSurfaceContracts.includes(required),
    `External surface guard missing ${required}`,
  );
}

const deployableContracts = read("core/operator-agent/src/product/deployable-artifact-contracts.ts");
for (const required of [
  "noDirectDeployment: true",
  "noExternalStateOwnership: true",
  "stateOwnership",
  "validateExternalSurfaceContent",
]) {
  assert(
    deployableContracts.includes(required),
    `Deployable artifact guard missing ${required}`,
  );
}

console.log("boundary-enforcement-check passed");