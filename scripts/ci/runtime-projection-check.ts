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
  assert(tenant, "Expected tenant_internal_aep in /tenants");

  const tenantOverview = (await fetchJson(
    baseUrl,
    "/tenants/tenant_internal_aep",
  )) as {
    tenant: Record<string, unknown>;
    services: Array<Record<string, unknown>>;
  };

  assert.equal(tenantOverview.tenant.tenant_id, "tenant_internal_aep");

  const serviceIds = new Set(
    tenantOverview.services.map((service) => String(service.service_id ?? "")),
  );

  for (const expectedServiceId of [
    "service_control_plane",
    "service_operator_agent",
    "service_dashboard",
    "service_ops_console",
  ]) {
    assert(serviceIds.has(expectedServiceId), `Missing service: ${expectedServiceId}`);
  }

  const dashboardService = tenantOverview.services.find(
    (service) => service.service_id === "service_dashboard",
  );
  assert(dashboardService, "Expected service_dashboard in tenant overview");

  assertProjectionSource(
    dashboardService.source,
    ["catalog", "catalog_enriched"],
    "dashboard service source",
  );

  const environments = Array.isArray(dashboardService.environments)
    ? (dashboardService.environments as Array<Record<string, unknown>>)
    : [];

  const envNames = new Set(
    environments.map((env) => String(env.environment_name ?? "")),
  );

  for (const environmentName of ["preview", "staging", "production"]) {
    assert(envNames.has(environmentName), `Missing environment: ${environmentName}`);
  }

  for (const env of environments) {
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

  for (const env of serviceOverview.environments) {
    assertProjectionSource(
      env.source,
      ["catalog", "catalog_enriched"],
      "service overview environment source",
    );
  }

  console.log("runtime-projection-check passed", {
    tenantCount: tenantsPayload.tenants.length,
    serviceCount: tenantOverview.services.length,
    environmentCount: environments.length,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});