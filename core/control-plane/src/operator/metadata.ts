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

export async function listSeededTenants(
  db: D1Like,
): Promise<TenantSummary[]> {
  return listCatalogTenants(db);
}

export async function getSeededTenant(
  db: D1Like,
  tenantId: string,
): Promise<TenantSummary | null> {
  return getCatalogTenant(db, tenantId);
}

export async function listServicesForTenant(
  db: D1Like,
  tenantId: string,
): Promise<ServiceSummary[]> {
  return listCatalogServicesForTenant(db, tenantId);
}

export async function getService(
  db: D1Like,
  tenantId: string,
  serviceId: string,
): Promise<ServiceSummary | null> {
  return getCatalogService(db, tenantId, serviceId);
}

export async function listEnvironmentsForService(
  db: D1Like,
  tenantId: string,
  serviceId: string,
): Promise<EnvironmentSummary[]> {
  return listCatalogEnvironmentsForService(db, tenantId, serviceId);
}