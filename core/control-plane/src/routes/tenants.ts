// Legacy runtime/operator tenant routes.
// Commit 13.2 adds separate org catalog routes under /org/tenants.
// Keep these handlers stable for existing operator/dashboard behavior.
// Commit 13.5: these legacy runtime/operator routes are now catalog-backed
// through D1 org metadata rather than hardcoded seeded arrays.

import {
  json,
  maybeInjectRuntimeReadFailure,
  notFound,
  withRuntimeJsonBoundary,
} from "@aep/control-plane/lib/http";
import {
  assertRuntimeTenant,
  normalizeTenant,
} from "@aep/runtime-contract/runtime_contract";
import {
  getServiceOverview,
  getTenantOverview,
  listTenantSummaries,
} from "@aep/control-plane/operator/dashboard";
import { listServicesForTenant } from "@aep/control-plane/operator/metadata";

type EnvLike = {
  DB: D1Database;
  APP_ENV?: string;
  VALIDATION_LANE?: string;
  RUNTIME_READ_FAILURE_INJECTION_ENABLED?: string;
};

export async function handleTenantsRoute(
  request: Request,
  env: EnvLike,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/tenants",
    request,
    handler: async () => {
      maybeInjectRuntimeReadFailure(request, env);

      const tenants = (await listTenantSummaries(env.DB))
        .map(normalizeTenant)
        .map(assertRuntimeTenant);
      return json({ tenants });
    },
  });
}

export async function handleTenantOverviewRoute(
  request: Request,
  env: EnvLike,
  tenantId: string,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/tenants/:tenantId",
    request,
    tenantId,
    resourceId: tenantId,
    handler: async () => {
      const overview = await getTenantOverview(env.DB, tenantId);
      if (!overview) {
        return notFound(`tenant not found: ${tenantId}`);
      }

      return json(overview);
    },
  });
}

export async function handleTenantServicesRoute(
  request: Request,
  env: EnvLike,
  tenantId: string,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/tenants/:tenantId/services",
    request,
    tenantId,
    resourceId: tenantId,
    handler: async () => {
      const services = await listServicesForTenant(env.DB, tenantId);
      return json({ tenant_id: tenantId, services });
    },
  });
}

export async function handleServiceOverviewRoute(
  request: Request,
  env: EnvLike,
  tenantId: string,
  serviceId: string,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/tenants/:tenantId/services/:serviceId",
    request,
    tenantId,
    serviceId,
    resourceId: `${tenantId}:${serviceId}`,
    handler: async () => {
      const overview = await getServiceOverview(env.DB, tenantId, serviceId);
      if (!overview) {
        return notFound(
          `service not found: tenant=${tenantId} service=${serviceId}`,
        );
      }

      return json(overview);
    },
  });
}