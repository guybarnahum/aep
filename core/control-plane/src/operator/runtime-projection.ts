import type {
  RunSummary,
  ServiceSummary,
  TenantSummary,
} from "@aep/control-plane/operator/types";

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
    environments: [
      ...new Set(
        matchingRuns.map((run) => run.environment_name).filter(Boolean),
      ),
    ],
  };
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
        !catalogServices.some((service) => service.service_name === serviceName),
    )
    .map((serviceName) =>
      buildObservedServiceProjection(tenantId, serviceName, observedRuns),
    );

  return [...catalogServices, ...observedOnly];
}

export function resolveEnvironmentNames(
  serviceName: string,
  catalogEnvironmentNames: string[],
  observedRuns: RunSummary[],
): string[] {
  const discoveredEnvironmentNames = [
    ...new Set(
      observedRuns
        .filter((run) => run.service_name === serviceName)
        .map((run) => run.environment_name)
        .filter(Boolean),
    ),
  ];

  return catalogEnvironmentNames.length > 0
    ? [...new Set(catalogEnvironmentNames)]
    : discoveredEnvironmentNames;
}

function titleizeTenantId(tenantId: string): string {
  return tenantId
    .replace(/^t_/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}