import {
  getService,
  getTenant,
  listEnvironmentsForService,
  listServicesForTenant,
  listTenants,
} from "./metadata";
import { listRunSummaries } from "./runs";

type D1Like = D1Database;

export async function listTenantSummaries(_db: D1Like) {
  return listTenants();
}

export async function getTenantOverview(db: D1Like, tenantId: string) {
  const tenant = getTenant(tenantId);
  if (!tenant) return null;

  const services = listServicesForTenant(tenantId);
  const runs = (await listRunSummaries(db, 100)).filter(
    (run) => run.tenant_id === tenantId,
  );

  return {
    tenant,
    services: services.map((service) => {
      const environments = listEnvironmentsForService(tenantId, service.service_id);

      return {
        ...service,
        environments: environments.map((environment) => {
          const latestRun =
            runs.find(
              (run) =>
                run.service_name === service.service_name &&
                run.environment_name === environment.environment_name,
            ) ?? null;

          return {
            environment_name: environment.environment_name,
            latest_run: latestRun,
          };
        }),
      };
    }),
  };
}

export async function getServiceOverview(
  db: D1Like,
  tenantId: string,
  serviceId: string,
) {
  const tenant = getTenant(tenantId);
  const service = getService(tenantId, serviceId);
  if (!tenant || !service) return null;

  const runs = (await listRunSummaries(db, 100)).filter(
    (run) =>
      run.tenant_id === tenantId &&
      run.service_name === service.service_name,
  );

  const environments = listEnvironmentsForService(tenantId, serviceId);

  return {
    tenant,
    service,
    environments: environments.map((environment) => {
      const matchingRuns = runs.filter(
        (run) => run.environment_name === environment.environment_name,
      );

      return {
        environment_name: environment.environment_name,
        latest_run: matchingRuns[0] ?? null,
        recent_runs: matchingRuns.slice(0, 10),
      };
    }),
  };
}