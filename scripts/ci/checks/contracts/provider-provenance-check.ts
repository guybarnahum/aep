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
    services: Array<Record<string, unknown>>;
  };

  const dashboardService = tenantOverview.services.find(
    (service) => service.service_id === "service_dashboard",
  );

  assert(dashboardService, "Expected service_dashboard in tenant overview");
  assert.equal(dashboardService.provider, "cloudflare");
  assert.equal(dashboardService.provider_source, "catalog");

  const serviceOverview = (await fetchJson(
    baseUrl,
    "/tenants/tenant_internal_aep/services/service_dashboard",
  )) as {
    service: Record<string, unknown>;
  };

  assert.equal(serviceOverview.service.service_id, "service_dashboard");
  assert.equal(serviceOverview.service.provider, "cloudflare");
  assert.equal(serviceOverview.service.provider_source, "catalog");

  console.log("provider-provenance-check passed", {
    provider: serviceOverview.service.provider,
    providerSource: serviceOverview.service.provider_source,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});