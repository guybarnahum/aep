/* eslint-disable no-console */

import {
  TASK_CONTRACTS,
  validateTaskDelegationPattern,
} from "../../../../core/operator-agent/src/lib/task-contracts";

const expectedEdges = [
  ["task_graph_planning", "web_design"],
  ["web_design", "web_implementation"],
  ["web_implementation", "deployment"],
  ["deployment", "verification"],
  ["verification", "bug_report"],
  ["bug_report", "web_implementation"],
] as const;

for (const [sourceTaskType, delegatedTaskType] of expectedEdges) {
  const result = validateTaskDelegationPattern({
    sourceTaskType,
    delegatedTaskType,
  });

  if (!result.ok) {
    throw new Error(
      `Expected delegation edge ${sourceTaskType} -> ${delegatedTaskType}: ${JSON.stringify(result)}`,
    );
  }
}

const forbidden = validateTaskDelegationPattern({
  sourceTaskType: "deployment",
  delegatedTaskType: "requirements_definition",
});

if (forbidden.ok) {
  throw new Error("Expected deployment -> requirements_definition to be disallowed");
}

for (const contract of TASK_CONTRACTS) {
  for (const nextType of contract.delegation?.allowedNextTaskTypes ?? []) {
    const result = validateTaskDelegationPattern({
      sourceTaskType: contract.taskType,
      delegatedTaskType: nextType,
    });

    if (!result.ok) {
      throw new Error(
        `Contract declares invalid delegation edge ${contract.taskType} -> ${nextType}`,
      );
    }
  }
}

console.log("task-delegation-pattern-contract-check passed", {
  contractCount: TASK_CONTRACTS.length,
  expectedEdges: expectedEdges.length,
});
