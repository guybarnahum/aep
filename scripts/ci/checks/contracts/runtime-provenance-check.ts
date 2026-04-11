/* eslint-disable no-console */

import assert from "node:assert/strict";
import { fetchJson } from "../../../lib/http-json";

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

  const tenantOverview = (await fetchJson(
    baseUrl,
    "/tenants/tenant_internal_aep",
  )) as {
    tenant: Record<string, unknown>;
    services: Array<Record<string, unknown>>;
  };

  const dashboardService = tenantOverview.services.find(
    (service) => service.service_id === "service_dashboard",
  );
  assert(dashboardService, "Expected service_dashboard in tenant overview");
  assertProjectionSource(
    dashboardService.source,
    ["catalog", "catalog_enriched"],
    "dashboard service source",
  );
  assert.equal(dashboardService.provider, "cloudflare");
  assert.equal(dashboardService.provider_source, "catalog");

  const tenantEnvironments = Array.isArray(dashboardService.environments)
    ? dashboardService.environments
    : [];

  for (const env of tenantEnvironments) {
    assertProjectionSource(
      env.source,
      ["catalog", "catalog_enriched"],
      "tenant overview environment source",
    );
  }

  const serviceOverview = (await fetchJson(
    baseUrl,
    "/tenants/tenant_internal_aep/services/service_dashboard",
  )) as {
    service: Record<string, unknown>;
    environments: Array<Record<string, unknown>>;
  };

  assert.equal(serviceOverview.service.service_id, "service_dashboard");
  assertProjectionSource(
    serviceOverview.service.source,
    ["catalog", "catalog_enriched"],
    "service overview source",
  );
  assert.equal(serviceOverview.service.provider, "cloudflare");
  assert.equal(serviceOverview.service.provider_source, "catalog");

  for (const env of serviceOverview.environments) {
    assertProjectionSource(
      env.source,
      ["catalog", "catalog_enriched"],
      "service overview environment source",
    );
  }

  console.log("runtime-provenance-check passed", {
    serviceSource: dashboardService.source,
    providerSource: dashboardService.provider_source,
    environmentCount: serviceOverview.environments.length,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});