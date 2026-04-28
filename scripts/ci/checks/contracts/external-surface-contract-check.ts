/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EXTERNAL_SURFACE_CONTRACTS,
  EXTERNAL_SURFACE_KINDS,
  getExternalSurfaceContract,
} from "@aep/operator-agent/product/external-surface-contracts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(
  EXTERNAL_SURFACE_CONTRACTS.length === EXTERNAL_SURFACE_KINDS.length,
  "Each external surface kind must have exactly one contract",
);

for (const surfaceKind of EXTERNAL_SURFACE_KINDS) {
  const contract = getExternalSurfaceContract(surfaceKind);
  assert(contract.canonicalOwner === "aep", `${surfaceKind} must be AEP-owned`);
  assert(
    contract.externalStateOwnershipAllowed === false,
    `${surfaceKind} must deny external state ownership`,
  );
  assert(
    contract.privateCognitionExposureAllowed === false,
    `${surfaceKind} must deny private cognition exposure`,
  );
  assert(
    contract.directTaskMutationAllowed === false,
    `${surfaceKind} must deny direct task mutation`,
  );
  assert(
    contract.directApprovalMutationAllowed === false,
    `${surfaceKind} must deny direct approval mutation`,
  );
  assert(
    contract.directDeploymentMutationAllowed === false,
    `${surfaceKind} must deny direct deployment mutation`,
  );
  assert(
    contract.requiredContentFields.includes("stateOwnership"),
    `${surfaceKind} must require stateOwnership`,
  );
  assert(
    contract.requiredContentFields.includes("publicDataPolicy"),
    `${surfaceKind} must require publicDataPolicy`,
  );
}

const contractSource = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/product/external-surface-contracts.ts"),
  "utf8",
);

for (const denied of [
  "privateCognitionExposureAllowed: false",
  "directTaskMutationAllowed: false",
  "directApprovalMutationAllowed: false",
  "directDeploymentMutationAllowed: false",
  "externalStateOwnershipAllowed: false",
]) {
  assert(contractSource.includes(denied), `Missing external surface invariant: ${denied}`);
}

for (const forbiddenRoute of [
  "/agent/tasks",
  "/agent/approvals",
  "/agent/product-deployments",
  "/agent/employees",
  "/agent/staffing",
]) {
  assert(
    contractSource.includes(forbiddenRoute),
    `External surface contract must guard direct mutation route ${forbiddenRoute}`,
  );
}

const deployableSource = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/product/deployable-artifact-contracts.ts"),
  "utf8",
);
assert(
  deployableSource.includes("validateExternalSurfaceContent"),
  "Deployable artifact validation must invoke external surface validation",
);

const artifactRouteSource = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/routes/task-artifacts.ts"),
  "utf8",
);
assert(
  artifactRouteSource.includes("ExternalSurfaceValidationError"),
  "Task artifact route must return bounded external surface validation errors",
);

console.log("external-surface-contract-check passed", {
  externalSurfaceKinds: EXTERNAL_SURFACE_KINDS.length,
});
