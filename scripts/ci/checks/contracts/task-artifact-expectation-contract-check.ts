/* eslint-disable no-console */

import {
  TASK_CONTRACTS,
  evaluateTaskArtifactExpectations,
} from "../../../../core/operator-agent/src/lib/task-contracts";

for (const contract of TASK_CONTRACTS) {
  if (contract.expectedArtifacts.length === 0) {
    throw new Error(`Task contract has no expected artifacts: ${contract.taskType}`);
  }

  const satisfied = evaluateTaskArtifactExpectations({
    taskType: contract.taskType,
    artifactTypes: contract.expectedArtifacts,
  });

  if (satisfied.status !== "satisfied") {
    throw new Error(
      `Expected ${contract.taskType} to satisfy artifact expectations: ${JSON.stringify(satisfied)}`,
    );
  }

  const missing = evaluateTaskArtifactExpectations({
    taskType: contract.taskType,
    artifactTypes: [],
  });

  if (missing.status !== "missing_expected_artifacts") {
    throw new Error(
      `Expected ${contract.taskType} with no artifacts to miss expectations: ${JSON.stringify(missing)}`,
    );
  }
}

console.log("task-artifact-expectation-contract-check passed", {
  contractCount: TASK_CONTRACTS.length,
});
