import assert from "node:assert/strict";
import test from "node:test";
import { getCloudflareAccessIdentity } from "./cloudflare-access";
import type { OperatorAgentEnv } from "../types";

const baseEnv: Partial<OperatorAgentEnv> = {};

function makeRequest(headers: Record<string, string>): Request {
  return new Request("https://example.com/agent/auth/me", { headers });
}

test("getCloudflareAccessIdentity extracts identity from Cf-Access-Authenticated-User-Email header", () => {
  const request = makeRequest({
    "Cf-Access-Authenticated-User-Email": "alice@example.com",
  });

  const identity = getCloudflareAccessIdentity(request, baseEnv as OperatorAgentEnv);

  assert.ok(identity !== null);
  assert.equal(identity.email, "alice@example.com");
  assert.equal(identity.provider, "cloudflare-access");
});

test("getCloudflareAccessIdentity fails closed when no Access header or JWT is present", () => {
  const request = makeRequest({});

  const identity = getCloudflareAccessIdentity(request, baseEnv as OperatorAgentEnv);

  assert.equal(identity, null);
});

test("getCloudflareAccessIdentity returns local-dev fallback only when AUTH_REQUIRED=false", () => {
  const request = makeRequest({});

  const identityWithRequired = getCloudflareAccessIdentity(request, {
    ...baseEnv,
    AUTH_REQUIRED: "true",
  } as OperatorAgentEnv);
  assert.equal(identityWithRequired, null);

  const identityWithFallback = getCloudflareAccessIdentity(request, {
    ...baseEnv,
    AUTH_REQUIRED: "false",
  } as OperatorAgentEnv);
  assert.ok(identityWithFallback !== null);
  assert.equal(identityWithFallback.email, "local-operator@local.aep");
  assert.equal(identityWithFallback.provider, "local-dev");
});
