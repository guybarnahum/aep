import type {
  EnvironmentSummary,
  ServiceSummary,
  TenantSummary,
} from "@aep/control-plane/operator/types";

type D1Like = D1Database;

type OrgTenantRow = {
  id: string;
  name: string;
};

type ServiceCatalogRow = {
  id: string;
  tenant_id: string | null;
  slug: string;
  name: string;
  kind: string;
  provider: string | null;
};

type TenantEnvironmentRow = {
  id: string;
  tenant_id: string;
  environment_name: string;
  kind: string;
};

export async function listCatalogTenants(db: D1Like): Promise<TenantSummary[]> {
  const rows = await db
    .prepare(
      `SELECT id, name
       FROM org_tenants
       ORDER BY id`,
    )
    .all<OrgTenantRow>();

  return (rows.results ?? []).map((row) => ({
    tenant_id: row.id,
    name: row.name,
    service_count: 0,
    environment_count: 0,
    source: "seeded" as const,
  }));
}

export async function getCatalogTenant(
  db: D1Like,
  tenantId: string,
): Promise<TenantSummary | null> {
  const row = await db
    .prepare(
      `SELECT id, name
       FROM org_tenants
       WHERE id = ?
       LIMIT 1`,
    )
    .bind(tenantId)
    .first<OrgTenantRow>();

  if (!row) {
    return null;
  }

  const serviceCountRow = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM services_catalog
       WHERE tenant_id = ?`,
    )
    .bind(tenantId)
    .first<{ count: number | string }>();

  const environmentCountRow = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM tenant_environments
       WHERE tenant_id = ?`,
    )
    .bind(tenantId)
    .first<{ count: number | string }>();

  const serviceCount =
    typeof serviceCountRow?.count === "number"
      ? serviceCountRow.count
      : Number.parseInt(String(serviceCountRow?.count ?? "0"), 10);

  const environmentCount =
    typeof environmentCountRow?.count === "number"
      ? environmentCountRow.count
      : Number.parseInt(String(environmentCountRow?.count ?? "0"), 10);

  return {
    tenant_id: row.id,
    name: row.name,
    service_count: serviceCount,
    environment_count: environmentCount,
    source: "seeded",
  };
}

export async function listCatalogServicesForTenant(
  db: D1Like,
  tenantId: string,
): Promise<ServiceSummary[]> {
  const serviceRows = await db
    .prepare(
      `SELECT id, tenant_id, slug, name, kind, provider
       FROM services_catalog
       WHERE tenant_id = ?
       ORDER BY id`,
    )
    .bind(tenantId)
    .all<ServiceCatalogRow>();

  const environmentRows = await db
    .prepare(
      `SELECT tenant_id, environment_name
       FROM tenant_environments
       WHERE tenant_id = ?
       ORDER BY environment_name`,
    )
    .bind(tenantId)
    .all<TenantEnvironmentRow>();

  const environmentNames = [
    ...new Set(
      (environmentRows.results ?? []).map((row) => row.environment_name),
    ),
  ];

  return (serviceRows.results ?? []).map((row) => ({
    tenant_id: row.tenant_id ?? tenantId,
    service_id: row.id,
    service_name: row.slug,
    provider: row.provider ?? inferProvider(row.kind, row.slug),
    environments: environmentNames,
    source: "catalog" as const,
  }));
}

export async function getCatalogService(
  db: D1Like,
  tenantId: string,
  serviceId: string,
): Promise<ServiceSummary | null> {
  const row = await db
    .prepare(
      `SELECT id, tenant_id, slug, name, kind, provider
       FROM services_catalog
       WHERE tenant_id = ? AND id = ?
       LIMIT 1`,
    )
    .bind(tenantId, serviceId)
    .first<ServiceCatalogRow>();

  if (!row) {
    return null;
  }

  const environmentRows = await db
    .prepare(
      `SELECT environment_name
       FROM tenant_environments
       WHERE tenant_id = ?
       ORDER BY environment_name`,
    )
    .bind(tenantId)
    .all<TenantEnvironmentRow>();

  return {
    tenant_id: row.tenant_id ?? tenantId,
    service_id: row.id,
    service_name: row.slug,
    provider: row.provider ?? inferProvider(row.kind, row.slug),
    environments: [
      ...new Set(
        (environmentRows.results ?? []).map((env) => env.environment_name),
      ),
    ],
    source: "catalog" as const,
  };
}

export async function listCatalogEnvironmentsForService(
  db: D1Like,
  tenantId: string,
  serviceId: string,
): Promise<EnvironmentSummary[]> {
  const service = await getCatalogService(db, tenantId, serviceId);
  if (!service) {
    return [];
  }

  const rows = await db
    .prepare(
      `SELECT tenant_id, environment_name
       FROM tenant_environments
       WHERE tenant_id = ?
       ORDER BY environment_name`,
    )
    .bind(tenantId)
    .all<TenantEnvironmentRow>();

  return (rows.results ?? []).map((row) => ({
    tenant_id: row.tenant_id,
    service_id: serviceId,
    environment_name: row.environment_name,
  }));
}

function inferProvider(kind: string, slug: string): string | null {
  if (slug.includes("control-plane") || slug.includes("operator-agent")) {
    return "cloudflare";
  }

  if (slug.includes("dashboard") || slug.includes("ops-console")) {
    return "cloudflare";
  }

  if (kind === "frontend" || kind === "backend") {
    return "cloudflare";
  }

  return null;
}