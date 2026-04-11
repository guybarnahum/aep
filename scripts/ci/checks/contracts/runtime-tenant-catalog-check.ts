/* eslint-disable no-console */
import { assert } from "../../shared/assert";
import { fetchJson } from "../../../lib/http-json";

function expectTenantIds(
  tenants: Array<Record<string, unknown>>,
  expectedIds: string[],
): void {
  const ids = new Set(tenants.map((tenant) => String(tenant.tenant_id ?? "")));

  for (const expectedId of expectedIds) {
    assert(ids.has(expectedId), `Missing tenant: ${expectedId}`);
  }
}

function expectServiceIds(
  services: Array<Record<string, unknown>>,
  expectedIds: string[],
): void {
  const ids = new Set(services.map((service) => String(service.service_id ?? "")));

  for (const expectedId of expectedIds) {
    assert(ids.has(expectedId), `Missing service: ${expectedId}`);
  }
}

async function main(): Promise<void> {
  const baseUrl = process.env.CONTROL_PLANE_BASE_URL;
  if (!baseUrl) {
    throw new Error("Missing CONTROL_PLANE_BASE_URL");
  }

  const tenantsPayload = (await fetchJson(baseUrl, "/tenants")) as {
    tenants: Array<Record<string, unknown>>;
  };

  expectTenantIds(tenantsPayload.tenants, [
    "tenant_internal_aep",
    "tenant_qa",
    "tenant_async_validation",
  ]);

  const tenantOverview = (await fetchJson(
    baseUrl,
    "/tenants/tenant_internal_aep",
  )) as {
    tenant: Record<string, unknown>;
    services: Array<Record<string, unknown>>;
  };

  assert.equal(tenantOverview.tenant.tenant_id, "tenant_internal_aep");
  expectServiceIds(tenantOverview.services, [
    "service_control_plane",
    "service_operator_agent",
    "service_dashboard",
    "service_ops_console",
  ]);

  const tenantServices = (await fetchJson(
    baseUrl,
    "/tenants/tenant_internal_aep/services",
  )) as {
    tenant_id: string;
    services: Array<Record<string, unknown>>;
  };

  assert.equal(tenantServices.tenant_id, "tenant_internal_aep");
  expectServiceIds(tenantServices.services, [
    "service_control_plane",
    "service_operator_agent",
    "service_dashboard",
    "service_ops_console",
  ]);

  const serviceOverview = (await fetchJson(
    baseUrl,
    "/tenants/tenant_internal_aep/services/service_dashboard",
  )) as {
    tenant: Record<string, unknown>;
    service: Record<string, unknown>;
    environments: Array<Record<string, unknown>>;
  };

  assert.equal(serviceOverview.tenant.tenant_id, "tenant_internal_aep");
  assert.equal(serviceOverview.service.service_id, "service_dashboard");

  const envNames = new Set(
    serviceOverview.environments.map((env) =>
      String(env.environment_name ?? ""),
    ),
  );

  for (const environmentName of ["preview", "staging", "production"]) {
    assert(envNames.has(environmentName), `Missing environment: ${environmentName}`);
  }

  console.log("runtime-tenant-catalog-check passed", {
    tenantCount: tenantsPayload.tenants.length,
    serviceCount: tenantServices.services.length,
    environmentCount: serviceOverview.environments.length,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});