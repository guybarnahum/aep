import assert from "node:assert/strict";
import test from "node:test";
import { operatorIdFromEmail, resolveOperatorIdentity } from "./operator-identity";
import type { OperatorAgentEnv } from "../types";
import type { CloudflareAccessIdentity } from "./auth-types";

const baseEnv: Partial<OperatorAgentEnv> = {};

const aliceIdentity: CloudflareAccessIdentity = {
  email: "alice@example.com",
  name: "Alice Example",
  picture: "https://cdn.example.com/alice.jpg",
  provider: "google",
  providerUserId: "g-12345",
};

test("operatorIdFromEmail converts email local part to operator: prefixed slug", () => {
  assert.equal(operatorIdFromEmail("alice@example.com"), "operator:alice");
  assert.equal(operatorIdFromEmail("john.doe@example.com"), "operator:john-doe");
  assert.equal(operatorIdFromEmail("TEST.USER@example.com"), "operator:test-user");
  assert.equal(operatorIdFromEmail("@nodomain"), "operator:user");
});

test("resolveOperatorIdentity preserves metadata from CloudflareAccessIdentity", () => {
  const result = resolveOperatorIdentity(aliceIdentity, baseEnv as OperatorAgentEnv);

  assert.ok(result !== null);
  assert.equal(result.operatorId, "operator:alice");
  assert.equal(result.email, "alice@example.com");
  assert.equal(result.name, "Alice Example");
  assert.equal(result.picture, "https://cdn.example.com/alice.jpg");
  assert.equal(result.provider, "google");
  assert.equal(result.providerUserId, "g-12345");
});

test("resolveOperatorIdentity denies access when email is not in non-empty OPERATOR_ALLOWLIST", () => {
  const env = {
    ...baseEnv,
    OPERATOR_ALLOWLIST: "bob@example.com,carol@example.com",
  } as OperatorAgentEnv;

  const result = resolveOperatorIdentity(aliceIdentity, env);
  assert.equal(result, null);

  const bobIdentity: CloudflareAccessIdentity = { email: "bob@example.com" };
  const bobResult = resolveOperatorIdentity(bobIdentity, env);
  assert.ok(bobResult !== null);
  assert.equal(bobResult.operatorId, "operator:bob");
});

test("resolveOperatorIdentity grants all admin permissions when email is in OPERATOR_ADMIN_EMAILS", () => {
  const env = {
    ...baseEnv,
    OPERATOR_ADMIN_EMAILS: "alice@example.com",
  } as OperatorAgentEnv;

  const result = resolveOperatorIdentity(aliceIdentity, env);
  assert.ok(result !== null);
  assert.ok(result.permissions.includes("admin.runtime"));
  assert.ok(result.permissions.includes("deployment.approve"));
  assert.ok(result.permissions.includes("product.lifecycle.approve"));

  const emptyEnvResult = resolveOperatorIdentity(aliceIdentity, baseEnv as OperatorAgentEnv);
  assert.ok(emptyEnvResult !== null);
  assert.deepEqual(emptyEnvResult.permissions, ["product.lifecycle.request"]);
});
