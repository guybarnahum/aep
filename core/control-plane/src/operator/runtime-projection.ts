import type {
  RunSummary,
  ServiceSummary,
  TenantSummary,
} from "@aep/control-plane/operator/types";

function serviceMatchesObservedName(
  service: ServiceSummary,
  observedServiceName: string,
): boolean {
  return (
    service.service_id === observedServiceName ||
    service.service_name === observedServiceName
  );
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
  const tenantRuns = runs.filter((run) => run.tenant_id === tenantId);
  const services = [
    ...new Set(tenantRuns.map((run) => run.service_name).filter(Boolean)),
  ];
  const environments = [
    ...new Set(
      tenantRuns.map((run) => run.environment_name).filter(Boolean),
    ),
  ];

  return {
    tenant_id: tenantId,
    name: titleizeTenantId(tenantId),
    service_count: services.length,
    environment_count: environments.length,
    source: "observed",
  };
}

export function mergeTenantSummaries(
  catalogTenants: TenantSummary[],
  observedRuns: RunSummary[],
): TenantSummary[] {
  const observedIds = [
    ...new Set(observedRuns.map((run) => run.tenant_id).filter(Boolean)),
  ];

  const observedOnly = observedIds
    .filter(
      (tenantId) =>
        !catalogTenants.some((tenant) => tenant.tenant_id === tenantId),
    )
    .map((tenantId) => buildObservedTenantProjection(tenantId, observedRuns));

  return [...catalogTenants, ...observedOnly];
}

export function buildObservedServiceProjection(
  tenantId: string,
  serviceName: string,
  runs: RunSummary[],
): ServiceSummary {
  const matchingRuns = runs.filter(
    (run) => run.tenant_id === tenantId && run.service_name === serviceName,
  );

  return {
    tenant_id: tenantId,
    service_id: serviceName,
    service_name: serviceName,
    provider: matchingRuns[0]?.provider ?? null,
    provider_source: matchingRuns[0]?.provider ? "observed" : undefined,
    environments: [
      ...new Set(
        matchingRuns.map((run) => run.environment_name).filter(Boolean),
      ),
    ],
    source: "observed",
  };
}

export function markCatalogServices(
  services: ServiceSummary[],
): ServiceSummary[] {
  return services.map((service) => ({
    ...service,
    source: service.source ?? "catalog",
  }));
}

export function enrichCatalogServicesWithObservedState(
  tenantId: string,
  catalogServices: ServiceSummary[],
  observedRuns: RunSummary[],
): ServiceSummary[] {
  return catalogServices.map((service) => {
    const matchingRuns = observedRuns.filter(
      (run) =>
        run.tenant_id === tenantId &&
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
  const discoveredServiceNames = [
    ...new Set(
      observedRuns
        .filter((run) => run.tenant_id === tenantId)
        .map((run) => run.service_name)
        .filter(Boolean),
    ),
  ];

  const observedOnly = discoveredServiceNames
    .filter(
      (serviceName) =>
        !catalogServices.some((service) =>
          serviceMatchesObservedName(service, serviceName),
        ),
    )
    .map((serviceName) =>
      buildObservedServiceProjection(tenantId, serviceName, observedRuns),
    );

  const catalogWithRuntimeState = enrichCatalogServicesWithObservedState(
    tenantId,
    markCatalogServices(catalogServices),
    observedRuns,
  );

  return [...catalogWithRuntimeState, ...observedOnly];
}

export function resolveEnvironmentViews(
  serviceName: string,
  catalogEnvironmentNames: string[],
  observedRuns: RunSummary[],
): Array<{
  environment_name: string;
  source: "catalog" | "observed" | "catalog_enriched";
}> {
  const discoveredEnvironmentNames = [
    ...new Set(
      observedRuns
        .filter((run) => run.service_name === serviceName)
        .map((run) => run.environment_name)
        .filter(Boolean),
    ),
  ];

  if (catalogEnvironmentNames.length > 0) {
    return [...new Set(catalogEnvironmentNames)].map((environment_name) => ({
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
  return tenantId
    .replace(/^t_/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}