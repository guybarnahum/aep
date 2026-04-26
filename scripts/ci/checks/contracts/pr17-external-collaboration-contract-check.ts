/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EXTERNAL_ADAPTER_CONTRACTS,
  getExternalAdapterContract,
} from "../../../../core/operator-agent/src/adapters/external-collaboration-contract";

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
  getExternalAdapterContract("jira")?.implemented === false,
  "Jira-like adapter must remain design-only in PR17B",
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
  packageSource.includes("ci:pr17-external-collaboration-contract-check"),
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

console.log("pr17-external-collaboration-contract-check passed", {
  adapterCount: EXTERNAL_ADAPTER_CONTRACTS.length,
});
