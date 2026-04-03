import {
  getCatalogService,
  getCatalogTenant,
  listCatalogEnvironmentsForService,
  listCatalogServicesForTenant,
  listCatalogTenants,
} from "@aep/control-plane/operator/catalog-metadata";
import type {
  EnvironmentSummary,
  ServiceSummary,
  TenantSummary,
} from "@aep/control-plane/operator/types";

type D1Like = D1Database;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function listSeededTenants(
  db: D1Like,
): Promise<TenantSummary[]> {
  try {
    return await listCatalogTenants(db);
  } catch (error) {
    console.error("metadata.listSeededTenants failed", {
      message: errorMessage(error),
    });
    return [];
  }
}

export async function getSeededTenant(
  db: D1Like,
  tenantId: string,
): Promise<TenantSummary | null> {
  try {
    return await getCatalogTenant(db, tenantId);
  } catch (error) {
    console.error("metadata.getSeededTenant failed", {
      tenantId,
      message: errorMessage(error),
    });
    return null;
  }
}

export async function listServicesForTenant(
  db: D1Like,
  tenantId: string,
): Promise<ServiceSummary[]> {
  try {
    return await listCatalogServicesForTenant(db, tenantId);
  } catch (error) {
    console.error("metadata.listServicesForTenant failed", {
      tenantId,
      message: errorMessage(error),
    });
    return [];
  }
}

export async function getService(
  db: D1Like,
  tenantId: string,
  serviceId: string,
): Promise<ServiceSummary | null> {
  try {
    return await getCatalogService(db, tenantId, serviceId);
  } catch (error) {
    console.error("metadata.getService failed", {
      tenantId,
      serviceId,
      message: errorMessage(error),
    });
    return null;
  }
}

export async function listEnvironmentsForService(
  db: D1Like,
  tenantId: string,
  serviceId: string,
): Promise<EnvironmentSummary[]> {
  try {
    return await listCatalogEnvironmentsForService(db, tenantId, serviceId);
  } catch (error) {
    console.error("metadata.listEnvironmentsForService failed", {
      tenantId,
      serviceId,
      message: errorMessage(error),
    });
    return [];
  }
}