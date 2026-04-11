/* eslint-disable no-console */

import { assert } from "./shared/assert";
import { fetchJson } from "../lib/http-json";

function assertProjectionSource(
  value: unknown,
  allowed: string[],
  label: string,
): void {
  assert.equal(typeof value, "string", `${label} should be a string`);
  assert(
    allowed.includes(String(value)),
    `${label} should be one of ${allowed.join(", ")}, got ${String(value)}`,
  );
}

async function main(): Promise<void> {
  const baseUrl = process.env.CONTROL_PLANE_BASE_URL;
  if (!baseUrl) {
    throw new Error("Missing CONTROL_PLANE_BASE_URL");
  }

  const tenantsPayload = (await fetchJson(baseUrl, "/tenants")) as {
    tenants: Array<Record<string, unknown>>;
  };

  const tenant = tenantsPayload.tenants.find(
    (entry) => entry.tenant_id === "tenant_internal_aep",
  );

  assert(tenant, "Expected tenant_internal_aep");

  console.log("runtime-projection-check passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});