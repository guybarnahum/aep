/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEPLOYABLE_ARTIFACT_CONTRACTS,
  DEPLOYABLE_ARTIFACT_KINDS,
  getDeployableArtifactContract,
} from "@aep/operator-agent/product/deployable-artifact-contracts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

for (const kind of DEPLOYABLE_ARTIFACT_KINDS) {
  const contract = getDeployableArtifactContract(kind);
  assert(
    contract.canonicalContainer === "task_artifact",
    `${kind} must be represented as a canonical task artifact`,
  );
  assert(
    contract.deploymentRecordRequiredBeforeExposure === true,
    `${kind} must require deployment record before exposure`,
  );
  assert(
    contract.approvalRequiredBeforeExternalExposure === true,
    `${kind} must require approval before external exposure`,
  );
  assert(contract.noDirectDeployment === true, `${kind} must deny direct deployment`);
  assert(
    contract.noExternalStateOwnership === true,
    `${kind} must deny external state ownership`,
  );
  assert(
    contract.privateCognitionExposureAllowed === false,
    `${kind} must deny private cognition exposure`,
  );
  assert(
    contract.requiredContentFields.includes("projectId"),
    `${kind} must link to projectId`,
  );
  assert(
    contract.requiredContentFields.includes("productSurface"),
    `${kind} must link to productSurface`,
  );
  assert(
    contract.requiredContentFields.includes("stateOwnership"),
    `${kind} must declare state ownership`,
  );
}

assert(
  DEPLOYABLE_ARTIFACT_CONTRACTS.length === DEPLOYABLE_ARTIFACT_KINDS.length,
  "Every deployable artifact kind must have exactly one contract",
);

const routeSource = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/routes/task-artifacts.ts"),
  "utf8",
);
assert(
  routeSource.includes("validateDeployableArtifactContent"),
  "Task artifact creation must validate deployable artifact content",
);
assert(
  routeSource.includes("DeployableArtifactValidationError"),
  "Task artifact route must return bounded deployable artifact validation errors",
);

const contractSource = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/product/deployable-artifact-contracts.ts"),
  "utf8",
);
for (const denied of [
  "noDirectDeployment: true",
  "noExternalStateOwnership: true",
  "privateCognitionExposureAllowed: false",
]) {
  assert(contractSource.includes(denied), `Missing deployable artifact invariant: ${denied}`);
}

console.log("deployable-artifact-contract-check passed", {
  deployableArtifactKinds: DEPLOYABLE_ARTIFACT_KINDS.length,
});