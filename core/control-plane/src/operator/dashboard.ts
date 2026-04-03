import {
  getSeededTenant,
  getService,
  listEnvironmentsForService,
  listSeededTenants,
  listServicesForTenant,
} from "@aep/control-plane/operator/metadata";
import { listRunSummaries } from "@aep/control-plane/operator/runs";
import type { TenantSummary } from "@aep/control-plane/operator/types";

type D1Like = D1Database;

function titleizeTenantId(tenantId: string): string {
  return tenantId
    .replace(/^t_/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function listTenantSummaries(db: D1Like): Promise<TenantSummary[]> {
  const seeded = await listSeededTenants(db);
  const runs = await listRunSummaries(db, 200);

  const observedIds = [...new Set(runs.map((run) => run.tenant_id))].filter(Boolean);

  const observedOnly: TenantSummary[] = observedIds
    .filter((tenantId) => !seeded.some((tenant) => tenant.tenant_id === tenantId))
    .map((tenantId) => {
      const tenantRuns = runs.filter((run) => run.tenant_id === tenantId);
      const services = [...new Set(tenantRuns.map((run) => run.service_name))];
      const environments = [...new Set(tenantRuns.map((run) => run.environment_name))];

      return {
        tenant_id: tenantId,
        name: titleizeTenantId(tenantId),
        service_count: services.length,
        environment_count: environments.length,
        source: "observed",
      };
    });

  return [...seeded, ...observedOnly];
}

export async function getTenantOverview(db: D1Like, tenantId: string) {
  const allTenants = await listTenantSummaries(db);
  const tenant = allTenants.find((entry) => entry.tenant_id === tenantId) ?? null;
  if (!tenant) return null;

  const services = await listServicesForTenant(db, tenantId);
  const runs = (await listRunSummaries(db, 200)).filter(
    (run) => run.tenant_id === tenantId,
  );

  const discoveredServiceNames = [
    ...new Set(runs.map((run) => run.service_name).filter(Boolean)),
  ];

  const discoveredServices = discoveredServiceNames
    .filter(
      (serviceName) =>
        !services.some((service) => service.service_name === serviceName),
    )
    .map((serviceName) => ({
      tenant_id: tenantId,
      service_id: serviceName,
      service_name: serviceName,
      provider: runs.find((run) => run.service_name === serviceName)?.provider ?? null,
      environments: [
        ...new Set(
          runs
            .filter((run) => run.service_name === serviceName)
            .map((run) => run.environment_name),
        ),
      ],
    }));

  const allServices = [...services, ...discoveredServices];

  return {
    tenant,
    services: await Promise.all(
      allServices.map(async (service) => {
      const seededEnvironments = await listEnvironmentsForService(
        db,
        tenantId,
        service.service_id,
      );
      const discoveredEnvironmentNames = [
        ...new Set(
          runs
            .filter((run) => run.service_name === service.service_name)
            .map((run) => run.environment_name),
        ),
      ];

      const environmentNames =
        seededEnvironments.length > 0
          ? [...new Set(seededEnvironments.map((env) => env.environment_name))]
          : discoveredEnvironmentNames;

      return {
        ...service,
        environments: environmentNames.map((environment_name) => {
          const latestRun =
            runs.find(
              (run) =>
                run.service_name === service.service_name &&
                run.environment_name === environment_name,
            ) ?? null;

          return {
            environment_name,
            latest_run: latestRun,
          };
        }),
      };
    }),
    ),
  };
}

export async function getServiceOverview(
  db: D1Like,
  tenantId: string,
  serviceId: string,
) {
  const allTenants = await listTenantSummaries(db);
  const tenant = allTenants.find((entry) => entry.tenant_id === tenantId) ?? null;
  if (!tenant) return null;

  const seededService = await getService(db, tenantId, serviceId);
  const runs = (await listRunSummaries(db, 200)).filter(
    (run) =>
      run.tenant_id === tenantId &&
      run.service_name === serviceId,
  );

  const service =
    seededService ??
    (runs.length > 0
      ? {
          tenant_id: tenantId,
          service_id: serviceId,
          service_name: serviceId,
          provider: runs[0]?.provider ?? null,
          environments: [...new Set(runs.map((run) => run.environment_name))],
        }
      : null);

  if (!service) return null;

  const seededEnvironments = await listEnvironmentsForService(
    db,
    tenantId,
    serviceId,
  );
  const environmentNames =
    seededEnvironments.length > 0
      ? [...new Set(seededEnvironments.map((env) => env.environment_name))]
      : [...new Set(runs.map((run) => run.environment_name))];

  return {
    tenant,
    service,
    environments: environmentNames.map((environment_name) => {
      const matchingRuns = runs.filter(
        (run) => run.environment_name === environment_name,
      );

      return {
        environment_name,
        latest_run: matchingRuns[0] ?? null,
        recent_runs: matchingRuns.slice(0, 10),
      };
    }),
  };
}