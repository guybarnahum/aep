/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getExternalAdapterContract } from "@aep/operator-agent/adapters/external-collaboration-contract";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const jiraContract = getExternalAdapterContract("jira");
assert(jiraContract, "Missing Jira adapter contract");
assert(jiraContract.implemented === true, "Jira contract must be implemented in PR22");
assert(
  jiraContract.ownsCanonicalWorkState === false,
  "Jira contract must not own canonical work state",
);
assert(
  jiraContract.surfaces.includes("ticket_projection"),
  "Jira contract must include ticket projection surface",
);
assert(
  jiraContract.surfaces.includes("message_projection"),
  "Jira contract must include message projection surface",
);
assert(
  jiraContract.surfaces.includes("status_signal"),
  "Jira contract must include status signal surface",
);
assert(
  jiraContract.deniedCapabilities.includes("set_canonical_status_directly"),
  "Jira contract must deny direct canonical status mutation",
);

const indexSource = readFileSync(resolve(process.cwd(), "core/operator-agent/src/index.ts"), "utf8");
const jiraRouteSource = readFileSync(resolve(process.cwd(), "core/operator-agent/src/routes/jira.ts"), "utf8");
const jiraAdapterSource = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/adapters/jira-mirroring.ts"),
  "utf8",
);
const messagesRouteSource = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/routes/messages.ts"),
  "utf8",
);
const packageSource = readFileSync(resolve(process.cwd(), "package.json"), "utf8");

assert(
  indexSource.includes('url.pathname === "/agent/jira/projections"'),
  "index.ts must wire /agent/jira/projections",
);
assert(
  indexSource.includes('url.pathname === "/agent/jira/comments"'),
  "index.ts must wire /agent/jira/comments",
);
assert(
  indexSource.includes('url.pathname === "/agent/jira/status-signals"'),
  "index.ts must wire /agent/jira/status-signals",
);

assert(
  jiraRouteSource.includes("handleJiraProjection") &&
    jiraRouteSource.includes("handleJiraComment") &&
    jiraRouteSource.includes("handleJiraStatusSignal"),
  "jira.ts must define projection, comment, and status-signal handlers",
);

assert(
  jiraAdapterSource.includes('source: "system"'),
  "Jira ingest must mirror inbound activity as canonical system messages",
);
assert(
  jiraAdapterSource.includes("createExternalThreadProjection"),
  "Jira projection path must create external thread mappings",
);
assert(
  jiraAdapterSource.includes("createExternalMessageProjection"),
  "Jira comment ingest must create external message mappings",
);

for (const forbidden of [
  "updateTaskStatus",
  "updateProjectStatus",
  "createTask(",
  "createProject(",
  "updateProductDeploymentStatus",
  "executeProductDeployment",
]) {
  assert(
    !jiraAdapterSource.includes(forbidden),
    `Jira adapter must not directly mutate canonical work state via ${forbidden}`,
  );
}

assert(
  messagesRouteSource.includes('(body.channel !== "slack" && body.channel !== "email")'),
  "Generic inbound external message route must remain limited to slack/email",
);

assert(
  packageSource.includes('"ci:jira-ingest-contract-check"'),
  "package.json must expose ci:jira-ingest-contract-check",
);

console.log("jira-ingest-contract-check passed", {
  jiraImplemented: jiraContract.implemented,
  surfaces: jiraContract.surfaces,
});
