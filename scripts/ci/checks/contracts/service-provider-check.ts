/* eslint-disable no-console */

import assert from "node:assert/strict";
import { fetchJson } from "../../../lib/http-json";

async function main(): Promise<void> {
  const baseUrl = process.env.CONTROL_PLANE_BASE_URL;
  if (!baseUrl) {
    throw new Error("Missing CONTROL_PLANE_BASE_URL");
  }

  const tenantOverview = (await fetchJson(
    baseUrl,
    "/tenants/tenant_internal_aep",
  )) as {
    tenant: Record<string, unknown>;
    services: Array<Record<string, unknown>>;
  };

  const expectedProviders: Record<string, string> = {
    service_control_plane: "cloudflare",
    service_operator_agent: "cloudflare",
    service_dashboard: "cloudflare",
    service_ops_console: "cloudflare",
  };

  for (const service of tenantOverview.services) {
    const serviceId = String(service.service_id ?? "");
    const expectedProvider = expectedProviders[serviceId];
    if (!expectedProvider) {
      continue;
    }

    assert.equal(
      service.provider,
      expectedProvider,
      `Unexpected provider for ${serviceId}`,
    );
  }

  const serviceOverview = (await fetchJson(
    baseUrl,
    "/tenants/tenant_internal_aep/services/service_dashboard",
  )) as {
    service: Record<string, unknown>;
  };

  assert.equal(serviceOverview.service.service_id, "service_dashboard");
  assert.equal(serviceOverview.service.provider, "cloudflare");

  console.log("service-provider-check passed", {
    checkedServiceCount: Object.keys(expectedProviders).length,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});