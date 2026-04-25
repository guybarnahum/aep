/* eslint-disable no-console */

import {
  TASK_CONTRACTS,
  getTaskContract,
  normalizeTaskType,
} from "../../../../core/operator-agent/src/lib/task-contracts";

const canonicalTypes = new Set<string>();

for (const contract of TASK_CONTRACTS) {
  if (canonicalTypes.has(contract.taskType)) {
    throw new Error(`Duplicate canonical task type: ${contract.taskType}`);
  }

  canonicalTypes.add(contract.taskType);

  if (contract.expectedTeamIds.length === 0) {
    throw new Error(`Task contract has no expected teams: ${contract.taskType}`);
  }

  if (contract.expectedArtifacts.length === 0) {
    throw new Error(`Task contract has no expected artifacts: ${contract.taskType}`);
  }

  if (!contract.payloadContract) {
    throw new Error(`Task contract has no payload contract: ${contract.taskType}`);
  }

  for (const field of contract.payloadContract.required) {
    if (!field.key.trim()) {
      throw new Error(`Task contract has an empty required payload key: ${contract.taskType}`);
    }
  }

  const resolved = getTaskContract(contract.taskType);
  if (resolved.taskType !== contract.taskType) {
    throw new Error(`Failed to resolve canonical task type: ${contract.taskType}`);
  }

  for (const alias of contract.legacyAliases ?? []) {
    const normalized = normalizeTaskType(alias);
    if (normalized !== contract.taskType) {
      throw new Error(
        `Legacy alias ${alias} normalized to ${normalized}, expected ${contract.taskType}`,
      );
    }
  }
}

const requiredTypes = [
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

for (const taskType of requiredTypes) {
  if (!canonicalTypes.has(taskType)) {
    throw new Error(`Missing required canonical task type: ${taskType}`);
  }
}

console.log("task-type-contract-check passed", {
  canonicalTaskTypeCount: canonicalTypes.size,
});
