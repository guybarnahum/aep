import type {
  RunSummary,
  ServiceSummary,
  TenantSummary,
} from "@aep/control-plane/operator/types";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function normalizeIdLike(value: unknown, fallback = "unknown"): string {
  if (!isNonEmptyString(value)) {
    return fallback;
  }

  return value.trim();
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(values.filter(isNonEmptyString).map((value) => value.trim())),
  ];
}

function serviceMatchesObservedName(
  service: ServiceSummary,
  observedServiceName: string,
): boolean {
  if (!isNonEmptyString(observedServiceName)) {
    return false;
  }

  const normalizedObserved = observedServiceName.trim();

  return (
    normalizeIdLike(service.service_id) === normalizedObserved ||
    normalizeIdLike(service.service_name) === normalizedObserved
  );
}

function sortByTenantId(a: TenantSummary, b: TenantSummary): number {
  return a.tenant_id.localeCompare(b.tenant_id);
}

function sortByServiceId(a: ServiceSummary, b: ServiceSummary): number {
  return a.service_id.localeCompare(b.service_id);
}

function sortStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

export interface ObservedTenantProjection {
  tenant_id: string;
  name: string;
  service_count: number;
  environment_count: number;
  source: "observed";
}

export interface ObservedServiceProjection {
  tenant_id: string;
  service_id: string;
  service_name: string;
  provider: string | null;
  environments: string[];
  provider_source?: "observed";
  source: "observed";
}

export function buildObservedTenantProjection(
  tenantId: string,
  runs: RunSummary[],
): TenantSummary {
  const normalizedTenantId = normalizeIdLike(tenantId);
  const tenantRuns = safeArray(runs).filter(
    (run) => normalizeIdLike(run.tenant_id) === normalizedTenantId,
  );
  const services = uniqueStrings(tenantRuns.map((run) => run.service_name));
  const environments = uniqueStrings(
    tenantRuns.map((run) => run.environment_name),
  );

  return {
    tenant_id: normalizedTenantId,
    name: titleizeTenantId(normalizedTenantId),
    service_count: services.length,
    environment_count: environments.length,
    source: "observed",
    is_internal: false,
  };
}

export function mergeTenantSummaries(
  catalogTenants: TenantSummary[],
  observedRuns: RunSummary[],
): TenantSummary[] {
  const catalog = safeArray(catalogTenants)
    .filter((tenant) => isNonEmptyString(tenant.tenant_id))
    .map((tenant) => ({
      ...tenant,
      tenant_id: tenant.tenant_id.trim(),
    }));

  const observedIds = uniqueStrings(
    safeArray(observedRuns).map((run) => run.tenant_id),
  );

  const observedOnly = observedIds
    .filter(
      (tenantId) =>
        !catalog.some((tenant) => tenant.tenant_id === tenantId),
    )
    .map((tenantId) => buildObservedTenantProjection(tenantId, observedRuns));

  return [...catalog, ...observedOnly].sort(sortByTenantId);
}

export function buildObservedServiceProjection(
  tenantId: string,
  serviceName: string,
  runs: RunSummary[],
): ServiceSummary {
  const normalizedTenantId = normalizeIdLike(tenantId);
  const normalizedServiceName = normalizeIdLike(serviceName);
  const matchingRuns = safeArray(runs).filter(
    (run) =>
      normalizeIdLike(run.tenant_id) === normalizedTenantId &&
      normalizeIdLike(run.service_name) === normalizedServiceName,
  );

  const environments = uniqueStrings(
    matchingRuns.map((run) => run.environment_name),
  ).sort(sortStrings);

  const firstProvider =
    matchingRuns.find((run) => isNonEmptyString(run.provider))?.provider ?? null;

  return {
    tenant_id: normalizedTenantId,
    service_id: normalizedServiceName,
    service_name: normalizedServiceName,
    provider: firstProvider,
    provider_source: firstProvider ? "observed" : undefined,
    environments,
    source: "observed",
  };
}

export function markCatalogServices(
  services: ServiceSummary[],
): ServiceSummary[] {
  return safeArray(services).map((service) => ({
    ...service,
    service_id: normalizeIdLike(service.service_id),
    service_name: normalizeIdLike(
      service.service_name,
      normalizeIdLike(service.service_id),
    ),
    environments: uniqueStrings(service.environments).sort(sortStrings),
    source: service.source ?? "catalog",
  }));
}

export function enrichCatalogServicesWithObservedState(
  tenantId: string,
  catalogServices: ServiceSummary[],
  observedRuns: RunSummary[],
): ServiceSummary[] {
  const normalizedTenantId = normalizeIdLike(tenantId);

  return safeArray(catalogServices).map((service) => {
    const matchingRuns = safeArray(observedRuns).filter(
      (run) =>
        normalizeIdLike(run.tenant_id) === normalizedTenantId &&
        serviceMatchesObservedName(service, run.service_name),
    );

    if (matchingRuns.length === 0) {
      return {
        ...service,
        source: service.source ?? "catalog",
      };
    }

    return {
      ...service,
      source: "catalog_enriched" as const,
    };
  });
}

export function mergeServiceSummaries(
  tenantId: string,
  catalogServices: ServiceSummary[],
  observedRuns: RunSummary[],
): ServiceSummary[] {
  const normalizedTenantId = normalizeIdLike(tenantId);

  const discoveredServiceNames = uniqueStrings(
    safeArray(observedRuns)
      .filter((run) => normalizeIdLike(run.tenant_id) === normalizedTenantId)
      .map((run) => run.service_name),
  );

  const normalizedCatalogServices = markCatalogServices(catalogServices);

  const observedOnly = discoveredServiceNames
    .filter(
      (serviceName) =>
        !normalizedCatalogServices.some((service) =>
          serviceMatchesObservedName(service, serviceName),
        ),
    )
    .map((serviceName) =>
      buildObservedServiceProjection(
        normalizedTenantId,
        serviceName,
        observedRuns,
      ),
    );

  const catalogWithRuntimeState = enrichCatalogServicesWithObservedState(
    normalizedTenantId,
    normalizedCatalogServices,
    observedRuns,
  );

  return [...catalogWithRuntimeState, ...observedOnly].sort(sortByServiceId);
}

export function resolveEnvironmentViews(
  serviceName: string,
  catalogEnvironmentNames: string[],
  observedRuns: RunSummary[],
): Array<{
  environment_name: string;
  source: "catalog" | "observed" | "catalog_enriched";
}> {
  const normalizedServiceName = normalizeIdLike(serviceName);

  const discoveredEnvironmentNames = uniqueStrings(
    safeArray(observedRuns)
      .filter(
        (run) => normalizeIdLike(run.service_name) === normalizedServiceName,
      )
      .map((run) => run.environment_name),
  ).sort(sortStrings);

  const normalizedCatalogEnvironmentNames = uniqueStrings(
    safeArray(catalogEnvironmentNames),
  ).sort(sortStrings);

  if (normalizedCatalogEnvironmentNames.length > 0) {
    return normalizedCatalogEnvironmentNames.map((environment_name) => ({
      environment_name,
      source: discoveredEnvironmentNames.includes(environment_name)
        ? "catalog_enriched" as const
        : "catalog" as const,
    }));
  }

  return discoveredEnvironmentNames.map((environment_name) => ({
    environment_name,
    source: "observed" as const,
  }));
}

export function resolveEnvironmentNames(
  serviceName: string,
  catalogEnvironmentNames: string[],
  observedRuns: RunSummary[],
): string[] {
  return resolveEnvironmentViews(
    serviceName,
    catalogEnvironmentNames,
    observedRuns,
  ).map((environment) => environment.environment_name);
}

function titleizeTenantId(tenantId: string): string {
  return normalizeIdLike(tenantId)
    .replace(/^t_/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}