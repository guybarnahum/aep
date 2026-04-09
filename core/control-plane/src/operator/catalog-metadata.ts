import type {
  EnvironmentSummary,
  ServiceSummary,
  TenantSummary,
} from "@aep/control-plane/operator/types";

type D1Like = D1Database;

type OrgTenantRow = {
  id: string;
  name: string;
  is_internal: number | string | null;
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function normalizeString(value: unknown, fallback = ""): string {
  if (!isNonEmptyString(value)) {
    return fallback;
  }

  return value.trim();
}

function normalizeOptionalString(value: unknown): string | null {
  if (!isNonEmptyString(value)) {
    return null;
  }

  return value.trim();
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(values.filter(isNonEmptyString).map((value) => value.trim())),
  ];
}

function parseCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  return 0;
}

function normalizeProvider(value: unknown): string | null {
  return normalizeOptionalString(value);
}

function normalizeSlug(value: unknown, fallback: string): string {
  const normalized = normalizeString(value, fallback);
  return normalized === "" ? fallback : normalized;
}

function normalizeName(value: unknown, fallback: string): string {
  const normalized = normalizeString(value, fallback);
  return normalized === "" ? fallback : normalized;
}

function sortByTenantId(a: TenantSummary, b: TenantSummary): number {
  return a.tenant_id.localeCompare(b.tenant_id);
}

function sortByServiceId(a: ServiceSummary, b: ServiceSummary): number {
  return a.service_id.localeCompare(b.service_id);
}

function sortByEnvironmentName(
  a: EnvironmentSummary,
  b: EnvironmentSummary,
): number {
  return a.environment_name.localeCompare(b.environment_name);
}

export async function listCatalogTenants(db: D1Like): Promise<TenantSummary[]> {
  const rows = await db
    .prepare(
      `SELECT id, name, is_internal
       FROM org_tenants
       ORDER BY id`,
    )
    .all<OrgTenantRow>();

  const tenants = (rows.results ?? [])
    .filter((row) => isNonEmptyString(row.id))
    .map((row) => ({
      tenant_id: row.id.trim(),
      name: normalizeName(row.name, row.id.trim()),
      service_count: 0,
      environment_count: 0,
      is_internal: parseBooleanFlag(row.is_internal),
      source: "seeded" as const,
    }));

  return tenants.sort(sortByTenantId);
}

export async function getCatalogTenant(
  db: D1Like,
  tenantId: string,
): Promise<TenantSummary | null> {
  const row = await db
    .prepare(
      `SELECT id, name, is_internal
       FROM org_tenants
       WHERE id = ?
       LIMIT 1`,
    )
    .bind(tenantId)
    .first<OrgTenantRow>();

  if (!row || !isNonEmptyString(row.id)) {
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

  return {
    tenant_id: row.id.trim(),
    name: normalizeName(row.name, row.id.trim()),
    service_count: parseCount(serviceCountRow?.count),
    environment_count: parseCount(environmentCountRow?.count),
    is_internal: parseBooleanFlag(row.is_internal),
    source: "seeded" as const,
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

  const environmentNames = uniqueStrings(
    (environmentRows.results ?? []).map((row) => row.environment_name),
  ).sort((a, b) => a.localeCompare(b));

  const services = (serviceRows.results ?? [])
    .filter((row) => isNonEmptyString(row.id))
    .map((row) => {
      const serviceId = row.id.trim();
      const serviceName = normalizeSlug(row.slug, serviceId);
      const resolvedProvider =
        normalizeProvider(row.provider) ?? inferProvider(row.kind, serviceName);
      const providerSource =
        normalizeProvider(row.provider) != null
          ? ("catalog" as const)
          : ("inferred" as const);

      return {
        tenant_id: normalizeString(row.tenant_id, tenantId),
        service_id: serviceId,
        service_name: serviceName,
        provider: resolvedProvider,
        provider_source: providerSource,
        environments: environmentNames,
        source: "catalog" as const,
      } satisfies ServiceSummary;
    });

  return services.sort(sortByServiceId);
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

  if (!row || !isNonEmptyString(row.id)) {
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

  const normalizedServiceId = row.id.trim();
  const normalizedServiceName = normalizeSlug(row.slug, normalizedServiceId);
  const explicitProvider = normalizeProvider(row.provider);
  const resolvedProvider =
    explicitProvider ?? inferProvider(row.kind, normalizedServiceName);

  return {
    tenant_id: normalizeString(row.tenant_id, tenantId),
    service_id: normalizedServiceId,
    service_name: normalizedServiceName,
    provider: resolvedProvider,
    provider_source: explicitProvider ? "catalog" : "inferred",
    environments: uniqueStrings(
      (environmentRows.results ?? []).map((env) => env.environment_name),
    ).sort((a, b) => a.localeCompare(b)),
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

  return uniqueStrings((rows.results ?? []).map((row) => row.environment_name))
    .map((environment_name) => ({
      tenant_id: tenantId,
      service_id: serviceId,
      environment_name,
    }))
    .sort(sortByEnvironmentName);
}

function inferProvider(kind: string, slug: string): string | null {
  const normalizedKind = normalizeString(kind).toLowerCase();
  const normalizedSlug = normalizeString(slug).toLowerCase();

  if (
    normalizedSlug.includes("control-plane") ||
    normalizedSlug.includes("operator-agent")
  ) {
    return "cloudflare";
  }

  if (
    normalizedSlug.includes("dashboard") ||
    normalizedSlug.includes("ops-console")
  ) {
    return "cloudflare";
  }

  if (normalizedKind === "frontend" || normalizedKind === "backend") {
    return "cloudflare";
  }

  return null;
}

function parseBooleanFlag(value: string | number | null): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true";
  }
  return false;
}
