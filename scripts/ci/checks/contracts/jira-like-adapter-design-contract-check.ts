/* eslint-disable no-console */

import {
  EXTERNAL_ADAPTER_CONTRACTS,
  JIRA_LIKE_STATUS_RECONCILIATION_RULES,
  getExternalAdapterContract,
} from "../../../../core/operator-agent/src/adapters/external-collaboration-contract";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const jira = getExternalAdapterContract("jira");

assert(jira, "Missing Jira-like external adapter contract");
assert(jira.implemented === false, "Jira-like adapter must remain design-only in PR17E");
assert(jira.ownsCanonicalWorkState === false, "Jira-like adapter must not own canonical work state");
assert(jira.requiresProjectionMapping === true, "Jira-like adapter must require projection mapping");

assert(
  jira.surfaces.includes("ticket_projection"),
  "Jira-like adapter must define ticket projection surface",
);

assert(
  jira.canonicalResources.includes("project") &&
    jira.canonicalResources.includes("task") &&
    jira.canonicalResources.includes("thread") &&
    jira.canonicalResources.includes("message"),
  "Jira-like adapter must project only existing canonical project/task/thread/message resources",
);

for (const denied of [
  "own_task_state",
  "own_project_state",
  "own_approval_state",
  "own_escalation_state",
  "set_canonical_status_directly",
  "expose_private_cognition",
  "mutate_without_canonical_route",
]) {
  assert(jira.deniedCapabilities.includes(denied), `Jira-like adapter must deny ${denied}`);
}

assert(
  JIRA_LIKE_STATUS_RECONCILIATION_RULES.length >= 4,
  "Expected Jira-like status reconciliation rules",
);

for (const rule of JIRA_LIKE_STATUS_RECONCILIATION_RULES) {
  assert(
    rule.directCanonicalMutationAllowed === false,
    `Jira-like status ${rule.externalStatus} must not directly mutate canonical state`,
  );
}

const adapterNames = new Set(EXTERNAL_ADAPTER_CONTRACTS.map((contract) => contract.adapter));
assert(adapterNames.has("jira"), "External adapter inventory must include Jira-like adapter");

console.log("jira-like-adapter-design-contract-check passed", {
  statusRuleCount: JIRA_LIKE_STATUS_RECONCILIATION_RULES.length,
});
