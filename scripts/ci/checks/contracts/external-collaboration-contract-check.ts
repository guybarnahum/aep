/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EXTERNAL_ADAPTER_CONTRACTS,
  getExternalAdapterContract,
} from "@aep/operator-agent/adapters/external-collaboration-contract";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const requiredAdapters = ["slack", "email", "jira"] as const;

for (const adapter of requiredAdapters) {
  const contract = getExternalAdapterContract(adapter);

  assert(contract, `Missing external adapter contract for ${adapter}`);
  assert(contract.ownsCanonicalWorkState === false, `${adapter} must not own canonical work state`);
  assert(
    contract.requiresProjectionMapping === true,
    `${adapter} must require projection mapping`,
  );
  assert(
    contract.deniedCapabilities.includes("expose_private_cognition"),
    `${adapter} must deny private cognition exposure`,
  );
  assert(
    contract.deniedCapabilities.includes("mutate_without_canonical_route"),
    `${adapter} must deny direct external mutation`,
  );
  assert(
    contract.policyEnforcement.includes("canonical_route"),
    `${adapter} must reconcile writes through canonical routes`,
  );
}

assert(
  getExternalAdapterContract("slack")?.implemented === true,
  "Slack contract must reflect implemented adapter support",
);

assert(
  getExternalAdapterContract("email")?.implemented === true,
  "Email contract must reflect implemented adapter support",
);

assert(
  getExternalAdapterContract("jira")?.implemented === true,
  "Jira adapter contract must reflect implemented mirror support",
);

const contractAdapters = new Set(
  EXTERNAL_ADAPTER_CONTRACTS.map((contract) => contract.adapter),
);

assert(
  contractAdapters.size === EXTERNAL_ADAPTER_CONTRACTS.length,
  "External adapter contracts must not contain duplicate adapters",
);

const dispatcherSource = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/adapters/mirror-dispatcher.ts"),
  "utf8",
);

const inboundCorrelationSource = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/adapters/inbound-correlation.ts"),
  "utf8",
);

const inboundActionCorrelationSource = readFileSync(
  resolve(
    process.cwd(),
    "core/operator-agent/src/adapters/inbound-action-correlation.ts",
  ),
  "utf8",
);

const externalPolicySource = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/adapters/external-policy.ts"),
  "utf8",
);

const messagesRouteSource = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/routes/messages.ts"),
  "utf8",
);

const packageSource = readFileSync(resolve(process.cwd(), "package.json"), "utf8");
const hardcodedGuardSource = readFileSync(
  resolve(process.cwd(), "scripts/ci/checks/contracts/no-hardcoded-runtime-identifiers-check.ts"),
  "utf8",
);

assert(
  dispatcherSource.includes("getExternalThreadProjection"),
  "Mirror dispatcher must preserve external thread projection lookup",
);

assert(
  dispatcherSource.includes("createExternalThreadProjection"),
  "Mirror dispatcher must preserve external thread projection creation",
);

assert(
  dispatcherSource.includes("createExternalMessageProjection"),
  "Mirror dispatcher must preserve external message projection creation",
);

assert(
  inboundCorrelationSource.includes("listExternalThreadProjectionsByExternal"),
  "Inbound reply correlation must resolve external thread IDs through projection maps",
);

assert(
  inboundActionCorrelationSource.includes("findThreadByExternalThreadId"),
  "External action correlation must resolve external thread IDs before canonical mutation",
);

assert(
  externalPolicySource.includes("authorizeInboundExternalReply"),
  "Inbound replies must remain policy-authorized",
);

assert(
  externalPolicySource.includes("authorizeExternalAction"),
  "External actions must remain policy-authorized",
);

assert(
  messagesRouteSource.includes("handleIngestExternalMessage"),
  "Inbound external message route must remain wired",
);

assert(
  messagesRouteSource.includes("handleExternalAction"),
  "External action route must remain wired",
);

assert(
  packageSource.includes("ci:external-collaboration-contract-check"),
  "package.json must expose PR17 external collaboration contract check",
);

assert(
  packageSource.includes("ci:slack-adapter-contract-check"),
  "package.json must expose Slack adapter hardening contract check",
);

assert(
  packageSource.includes("ci:email-adapter-contract-check"),
  "package.json must expose Email adapter hardening contract check",
);

assert(
  packageSource.includes("ci:jira-like-adapter-design-contract-check"),
  "package.json must expose Jira adapter contract check",
);

assert(
  packageSource.includes("ci:pr22-jira-ingest-contract-check"),
  "package.json must expose PR22 Jira ingest contract check",
);

const requiredPr17Scripts = [
  "ci:mirror-routing-contract-check",
  "ci:external-thread-mapping-contract-check",
  "ci:inbound-reply-correlation-contract-check",
  "ci:external-action-contract-check",
  "ci:external-interaction-policy-contract-check",
  "ci:slack-adapter-contract-check",
  "ci:email-adapter-contract-check",
  "ci:jira-like-adapter-design-contract-check",
  "ci:pr22-jira-ingest-contract-check",
  "ci:external-adapter-state-ownership-contract-check",
];

for (const scriptName of requiredPr17Scripts) {
  assert(packageSource.includes(`"${scriptName}"`), `Missing PR17 CI script ${scriptName}`);
}

assert(
  hardcodedGuardSource.includes("example\\.com"),
  "Runtime literal guard must continue checking placeholder recipient regex",
);

console.log("external-collaboration-contract-check passed", {
  adapterCount: EXTERNAL_ADAPTER_CONTRACTS.length,
});
