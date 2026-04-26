/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EXTERNAL_ADAPTER_CONTRACTS } from "@aep/operator-agent/src/adapters/external-collaboration-contract";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

for (const contract of EXTERNAL_ADAPTER_CONTRACTS) {
  assert(
    contract.ownsCanonicalWorkState === false,
    `${contract.adapter} must not own canonical work state`,
  );

  for (const denied of [
    "own_task_state",
    "own_project_state",
    "own_approval_state",
    "own_escalation_state",
    "expose_private_cognition",
    "mutate_without_canonical_route",
  ]) {
    assert(
      contract.deniedCapabilities.includes(denied),
      `${contract.adapter} must deny ${denied}`,
    );
  }
}

const adapterDirEntries = [
  "core/operator-agent/src/adapters/slack-webhook-adapter.ts",
  "core/operator-agent/src/adapters/email-adapter.ts",
  "core/operator-agent/src/adapters/external-collaboration-contract.ts",
];

for (const path of adapterDirEntries) {
  const source = readFileSync(resolve(process.cwd(), path), "utf8");

  assert(
    !source.includes("createTask(") &&
      !source.includes("updateTask(") &&
      !source.includes("createProject(") &&
      !source.includes("updateProject(") &&
      !source.includes("approveApproval(") &&
      !source.includes("resolveEscalation("),
    `${path} must not directly mutate canonical work/governance state`,
  );
}

console.log("external-adapter-state-ownership-contract-check passed", {
  adapterCount: EXTERNAL_ADAPTER_CONTRACTS.length,
});
