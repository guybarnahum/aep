/* eslint-disable no-console */

import assert from "node:assert/strict";

async function getJson(baseUrl: string, path: string): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`GET ${path} failed: ${response.status} ${text}`);
  }

  return JSON.parse(text);
}

async function main(): Promise<void> {
  const baseUrl = process.env.CONTROL_PLANE_BASE_URL;
  if (!baseUrl) {
    throw new Error("Missing CONTROL_PLANE_BASE_URL");
  }

  const tenantOverview = (await getJson(
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
  assert.equal(dashboardService.source, "catalog");

  const tenantEnvironments = Array.isArray(dashboardService.environments)
    ? dashboardService.environments
    : [];

  for (const env of tenantEnvironments) {
    assert.equal(env.source, "catalog");
  }

  const serviceOverview = (await getJson(
    baseUrl,
    "/tenants/tenant_internal_aep/services/service_dashboard",
  )) as {
    service: Record<string, unknown>;
    environments: Array<Record<string, unknown>>;
  };

  assert.equal(serviceOverview.service.service_id, "service_dashboard");
  assert.equal(serviceOverview.service.source, "catalog");

  for (const env of serviceOverview.environments) {
    assert.equal(env.source, "catalog");
  }

  console.log("runtime-provenance-check passed", {
    serviceSource: dashboardService.source,
    environmentCount: serviceOverview.environments.length,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});