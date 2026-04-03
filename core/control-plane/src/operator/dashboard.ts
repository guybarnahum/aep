import {
  getSeededTenant,
  getService,
  listEnvironmentsForService,
  listSeededTenants,
  listServicesForTenant,
} from "@aep/control-plane/operator/metadata";
import {
  mergeServiceSummaries,
  mergeTenantSummaries,
  resolveEnvironmentViews,
} from "@aep/control-plane/operator/runtime-projection";
import { listRunSummaries } from "@aep/control-plane/operator/runs";
import type { TenantSummary } from "@aep/control-plane/operator/types";

type D1Like = D1Database;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function listObservedRuns(
  db: D1Like,
  limit = 200,
) {
  try {
    return await listRunSummaries(db, limit);
  } catch (error) {
    console.error("operator dashboard observed-run fallback", error);
    return [];
  }
}

async function buildTenantServiceOverviewEntry(args: {
  db: D1Like;
  tenantId: string;
  service: Awaited<ReturnType<typeof mergeServiceSummaries>>[number];
  runs: Awaited<ReturnType<typeof listObservedRuns>>;
}) {
  const { db, tenantId, service, runs } = args;

  try {
    const seededEnvironments = await listEnvironmentsForService(
      db,
      tenantId,
      service.service_id,
    );

    const environmentViews = resolveEnvironmentViews(
      service.service_name,
      [...new Set(seededEnvironments.map((env) => env.environment_name))],
      runs,
    );

    return {
      ...service,
      environments: environmentViews.map(({ environment_name, source }) => {
        const latestRun =
          runs.find(
            (run) =>
              run.service_name === service.service_name &&
              run.environment_name === environment_name,
          ) ?? null;

        return {
          environment_name,
          latest_run: latestRun,
          source,
        };
      }),
    };
  } catch (error) {
    console.error("operator dashboard tenant service projection fallback", {
      tenantId,
      serviceId: service.service_id,
      message: errorMessage(error),
    });

    return {
      ...service,
      environments: [],
    };
  }
}

export async function listTenantSummaries(db: D1Like): Promise<TenantSummary[]> {
  const seeded = await listSeededTenants(db);
  const runs = await listObservedRuns(db, 200);

  return mergeTenantSummaries(seeded, runs);
}

export async function getTenantOverview(db: D1Like, tenantId: string) {
  const allTenants = await listTenantSummaries(db);
  const tenant = allTenants.find((entry) => entry.tenant_id === tenantId) ?? null;
  if (!tenant) return null;

  const services = await listServicesForTenant(db, tenantId);
  const runs = (await listObservedRuns(db, 200)).filter(
    (run) => run.tenant_id === tenantId,
  );

  const allServices = mergeServiceSummaries(tenantId, services, runs);

  return {
    tenant,
    services: await Promise.all(
      allServices.map((service) =>
        buildTenantServiceOverviewEntry({
          db,
          tenantId,
          service,
          runs,
        }),
      ),
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
  const runs = (await listObservedRuns(db, 200)).filter(
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
          provider_source: runs[0]?.provider ? "observed" as const : undefined,
          environments: [...new Set(runs.map((run) => run.environment_name))],
          source: "observed" as const,
        }
      : null);

  if (!service) return null;

  try {
    const seededEnvironments = await listEnvironmentsForService(
      db,
      tenantId,
      serviceId,
    );
    const environmentViews = resolveEnvironmentViews(
      service.service_name,
      [...new Set(seededEnvironments.map((env) => env.environment_name))],
      runs,
    );

    return {
      tenant,
      service,
      environments: environmentViews.map(({ environment_name, source }) => {
        const matchingRuns = runs.filter(
          (run) => run.environment_name === environment_name,
        );

        return {
          environment_name,
          latest_run: matchingRuns[0] ?? null,
          recent_runs: matchingRuns.slice(0, 10),
          source,
        };
      }),
    };
  } catch (error) {
    console.error("operator dashboard service overview environment fallback", {
      tenantId,
      serviceId,
      message: errorMessage(error),
    });

    return {
      tenant,
      service,
      environments: [],
    };
  }
}