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

function runtimeRouteError(args: {
  route: string;
  error: unknown;
  tenantId?: string;
  serviceId?: string;
}): Response {
  const message = args.error instanceof Error
    ? args.error.message
    : String(args.error);

  console.error("tenant route failure", {
    route: args.route,
    tenantId: args.tenantId,
    serviceId: args.serviceId,
    message,
  });

  return json(
    {
      error: "runtime_projection_failed",
      route: args.route,
      tenant_id: args.tenantId ?? null,
      service_id: args.serviceId ?? null,
      message,
    },
    { status: 500 },
  );
}

export async function handleTenantsRoute(
  _request: Request,
  env: EnvLike,
): Promise<Response> {
  try {
    const tenants = await listTenantSummaries(env.DB);
    return json({ tenants });
  } catch (error) {
    return runtimeRouteError({
      route: "/tenants",
      error,
    });
  }
}

export async function handleTenantOverviewRoute(
  _request: Request,
  env: EnvLike,
  tenantId: string,
): Promise<Response> {
  try {
    const overview = await getTenantOverview(env.DB, tenantId);
    if (!overview) {
      return notFound(`tenant not found: ${tenantId}`);
    }

    return json(overview);
  } catch (error) {
    return runtimeRouteError({
      route: "/tenants/:tenantId",
      error,
      tenantId,
    });
  }
}

export async function handleTenantServicesRoute(
  _request: Request,
  env: EnvLike,
  tenantId: string,
): Promise<Response> {
  try {
    const services = await listServicesForTenant(env.DB, tenantId);
    return json({ tenant_id: tenantId, services });
  } catch (error) {
    return runtimeRouteError({
      route: "/tenants/:tenantId/services",
      error,
      tenantId,
    });
  }
}

export async function handleServiceOverviewRoute(
  _request: Request,
  env: EnvLike,
  tenantId: string,
  serviceId: string,
): Promise<Response> {
  try {
    const overview = await getServiceOverview(env.DB, tenantId, serviceId);
    if (!overview) {
      return notFound(
        `service not found: tenant=${tenantId} service=${serviceId}`,
      );
    }

    return json(overview);
  } catch (error) {
    return runtimeRouteError({
      route: "/tenants/:tenantId/services/:serviceId",
      error,
      tenantId,
      serviceId,
    });
  }
}