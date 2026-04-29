/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  TASK_CONTRACTS,
  evaluateTaskArtifactExpectations,
  validateTaskDelegationPattern,
} from "../../../../core/operator-agent/src/lib/task-contracts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const requiredTaskTypes = [
  "project_planning",
  "requirements_definition",
  "task_graph_planning",
  "web_design",
  "web_implementation",
  "ui_iteration",
  "deployment",
  "monitoring_setup",
  "incident_response",
  "test_execution",
  "bug_report",
  "verification",
  "coordination",
  "analysis",
];

const taskContractsByType = new Map(
  TASK_CONTRACTS.map((contract) => [contract.taskType, contract]),
);

for (const taskType of requiredTaskTypes) {
  const contract = taskContractsByType.get(taskType as any);

  assert(contract, `Missing task contract: ${taskType}`);
  assert(contract.expectedTeamIds.length > 0, `Missing expected teams for ${taskType}`);
  assert(contract.expectedArtifacts.length > 0, `Missing artifact expectations for ${taskType}`);
  assert(contract.payloadContract.required.length > 0, `Missing payload contract for ${taskType}`);

  const artifactExpectation = evaluateTaskArtifactExpectations({
    taskType,
    artifactTypes: [],
  });

  assert(
    artifactExpectation.status === "missing_expected_artifacts",
    `Expected ${taskType} with no artifacts to report missing expectations`,
  );
}

const requiredDelegationEdges = [
  ["task_graph_planning", "web_design"],
  ["web_design", "web_implementation"],
  ["web_implementation", "deployment"],
  ["deployment", "verification"],
  ["verification", "bug_report"],
  ["bug_report", "web_implementation"],
] as const;

for (const [sourceTaskType, delegatedTaskType] of requiredDelegationEdges) {
  const result = validateTaskDelegationPattern({
    sourceTaskType,
    delegatedTaskType,
  });

  assert(
    result.ok,
    `Missing required delegation edge ${sourceTaskType} -> ${delegatedTaskType}`,
  );
}

const storeTypesSource = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/lib/store-types.ts"),
  "utf8",
);
const teamLoopSource = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/lib/team-work-loop.ts"),
  "utf8",
);
const indexSource = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/index.ts"),
  "utf8",
);
const packageSource = readFileSync(
  resolve(process.cwd(), "package.json"),
  "utf8",
);

assert(
  storeTypesSource.includes('| "parked"'),
  "Expected TaskStatus to include parked",
);
assert(
  teamLoopSource.includes("thinkWithinEmployeeBoundary("),
  "Expected team loop to use bounded cognition for scheduling",
);
assert(
  teamLoopSource.includes("derivePublicRationale(cognition)"),
  "Expected team loop to derive public scheduling rationale",
);
assert(
  teamLoopSource.includes("artifactExpectations"),
  "Expected team loop heartbeat to include artifact expectations",
);
assert(
  indexSource.includes("taskParkMatch") && indexSource.includes("handleParkTask"),
  "Expected task park route wiring",
);
assert(
  indexSource.includes("taskDelegateMatch") && indexSource.includes("handleDelegateTaskFromTask"),
  "Expected task delegate route wiring",
);

const requiredScripts = [
  "ci:task-type-contract-check",
  "ci:task-type-normalization-contract-check",
  "ci:task-payload-contract-check",
  "ci:task-payload-normalization-contract-check",
  "ci:team-loop-specialization-contract-check",
  "ci:team-loop-specialization-check",
  "ci:team-loop-cognitive-scheduling-contract-check",
  "ci:task-parking-contract-check",
  "ci:task-parking-live-check",
  "ci:team-loop-cognitive-scheduling-live-check",
  "ci:task-artifact-expectation-contract-check",
  "ci:task-artifact-expectation-live-check",
  "ci:task-delegation-pattern-contract-check",
  "ci:task-delegation-live-check",
];

for (const scriptName of requiredScripts) {
  assert(packageSource.includes(`"${scriptName}"`), `Missing role-realism CI script ${scriptName}`);
}

console.log("role-realism-contract-check passed", {
  taskContractCount: TASK_CONTRACTS.length,
  requiredTaskTypeCount: requiredTaskTypes.length,
  requiredDelegationEdgeCount: requiredDelegationEdges.length,
});
