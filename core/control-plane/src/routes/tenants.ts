// Legacy runtime/operator tenant routes.
// Commit 13.2 adds separate org catalog routes under /org/tenants.
// Keep these handlers stable for existing operator/dashboard behavior.
// Commit 13.5: these legacy runtime/operator routes are now catalog-backed
// through D1 org metadata rather than hardcoded seeded arrays.

import { json, notFound } from "@aep/control-plane/lib/http";
import {
  getServiceOverview,
  getTenantOverview,
  listTenantSummaries,
} from "@aep/control-plane/operator/dashboard";
import { listServicesForTenant } from "@aep/control-plane/operator/metadata";

type EnvLike = {
  DB: D1Database;
};

export async function handleTenantsRoute(
  _request: Request,
  env: EnvLike,
): Promise<Response> {
  const tenants = await listTenantSummaries(env.DB);
  return json({ tenants });
}

export async function handleTenantOverviewRoute(
  _request: Request,
  env: EnvLike,
  tenantId: string,
): Promise<Response> {
  const overview = await getTenantOverview(env.DB, tenantId);
  if (!overview) {
    return notFound(`tenant not found: ${tenantId}`);
  }

  return json(overview);
}

export async function handleTenantServicesRoute(
  _request: Request,
  env: EnvLike,
  tenantId: string,
): Promise<Response> {
  const services = await listServicesForTenant(env.DB, tenantId);
  return json({ tenant_id: tenantId, services });
}

export async function handleServiceOverviewRoute(
  _request: Request,
  env: EnvLike,
  tenantId: string,
  serviceId: string,
): Promise<Response> {
  const overview = await getServiceOverview(env.DB, tenantId, serviceId);
  if (!overview) {
    return notFound(
      `service not found: tenant=${tenantId} service=${serviceId}`,
    );
  }

  return json(overview);
}