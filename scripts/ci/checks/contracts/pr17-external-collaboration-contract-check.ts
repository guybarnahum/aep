/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EXTERNAL_ADAPTER_CONTRACTS } from "../../../../core/operator-agent/src/adapters/external-collaboration-contract";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const byAdapter = new Map(EXTERNAL_ADAPTER_CONTRACTS.map((contract) => [contract.adapter, contract]));

for (const adapter of ["slack", "email", "jira"] as const) {
  const contract = byAdapter.get(adapter);
  assert(contract, `Missing external adapter contract for ${adapter}`);
  assert(contract.ownsCanonicalWorkState === false, `${adapter} must not own canonical work state`);
  assert(contract.requiresProjectionMapping, `${adapter} must require projection mapping`);
  assert(contract.deniedCapabilities.includes("expose_private_cognition"), `${adapter} must deny cognition exposure`);
  assert(contract.deniedCapabilities.includes("mutate_without_canonical_route"), `${adapter} must deny direct mutation`);
}

assert(byAdapter.get("slack")?.implemented === true, "Slack contract should reflect existing implementation");
assert(byAdapter.get("email")?.implemented === true, "Email contract should reflect existing implementation");
assert(byAdapter.get("jira")?.implemented === false, "Jira should remain design-only in PR17E");

const dispatcher = readFileSync(resolve(process.cwd(), "core/operator-agent/src/adapters/mirror-dispatcher.ts"), "utf8");
const messagesRoute = readFileSync(resolve(process.cwd(), "core/operator-agent/src/routes/messages.ts"), "utf8");
const policy = readFileSync(resolve(process.cwd(), "core/operator-agent/src/adapters/external-policy.ts"), "utf8");
const packageSource = readFileSync(resolve(process.cwd(), "package.json"), "utf8");

assert(dispatcher.includes("getExternalThreadProjection"), "Mirror dispatcher must preserve thread projection mapping");
assert(dispatcher.includes("createExternalMessageProjection"), "Mirror dispatcher must preserve message projection mapping");
assert(messagesRoute.includes("handleIngestExternalMessage"), "Inbound reply route must remain wired");
assert(messagesRoute.includes("handleExternalAction"), "External action route must remain wired");
assert(policy.includes("authorizeInboundExternalReply"), "Inbound reply policy enforcement must remain code-owned");
assert(policy.includes("authorizeExternalAction"), "External action policy enforcement must remain code-owned");
assert(packageSource.includes("ci:pr17-external-collaboration-contract-check"), "Missing PR17 CI script");

console.log("pr17-external-collaboration-contract-check passed");
