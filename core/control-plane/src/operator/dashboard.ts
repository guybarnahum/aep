import {
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
import { listProjectionRunSummaries } from "@aep/control-plane/operator/runs";
import type {
  ServiceSummary,
  TenantSummary,
} from "@aep/control-plane/operator/types";

type D1Like = D1Database;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function normalizeString(value: unknown, fallback = ""): string {
  if (!isNonEmptyString(value)) {
    return fallback;
  }

  return value.trim();
}

function serviceMatchesRunServiceName(
  serviceId: string,
  serviceName: string,
  runServiceName: string,
): boolean {
  const normalizedRunServiceName = normalizeString(runServiceName);
  if (normalizedRunServiceName === "") {
    return false;
  }

  return (
    normalizedRunServiceName === normalizeString(serviceId) ||
    normalizedRunServiceName === normalizeString(serviceName)
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function safeListObservedRuns(
  db: D1Like,
  limit = 200,
) {
  try {
    return await listProjectionRunSummaries(db, limit);
  } catch (error) {
    console.error("operator dashboard observed-run fallback", {
      message: errorMessage(error),
    });
    return [];
  }
}

async function buildTenantServiceOverviewEntry(args: {
  db: D1Like;
  tenantId: string;
  service: Awaited<ReturnType<typeof mergeServiceSummaries>>[number];
  runs: Awaited<ReturnType<typeof safeListObservedRuns>>;
}) {
  const { db, tenantId, service, runs } = args;

  try {
    const seededEnvironments = await listEnvironmentsForService(
      db,
      tenantId,
      service.service_id,
    );

    const effectiveServiceName =
      normalizeString(service.service_name, service.service_id);

    const environmentViews = resolveEnvironmentViews(
      effectiveServiceName,
      [
        ...new Set(
          seededEnvironments
            .map((env) => normalizeString(env.environment_name))
            .filter((value) => value !== ""),
        ),
      ],
      runs,
    );

    return {
      ...service,
      service_name: effectiveServiceName,
      environments: environmentViews.map(({ environment_name, source }) => {
        const latestRun =
          runs.find(
            (run) =>
              serviceMatchesRunServiceName(
                service.service_id,
                effectiveServiceName,
                run.service_name,
              ) &&
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
      service_name: normalizeString(service.service_name, service.service_id),
      environments: [],
    };
  }
}

export async function listTenantSummaries(db: D1Like): Promise<TenantSummary[]> {
  const seeded = await listSeededTenants(db);
  const runs = await safeListObservedRuns(db, 200);

  return mergeTenantSummaries(seeded, runs);
}

export async function getTenantOverview(db: D1Like, tenantId: string) {
  const allTenants = await listTenantSummaries(db);
  const tenant = allTenants.find((entry) => entry.tenant_id === tenantId) ?? null;
  if (!tenant) return null;

  let services: ServiceSummary[] = [];
  try {
    services = await listServicesForTenant(db, tenantId);
  } catch (error) {
    console.error("operator dashboard tenant services fallback", {
      tenantId,
      message: errorMessage(error),
    });
    services = [];
  }

  const runs = (await safeListObservedRuns(db, 200)).filter(
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
  const runs = (await safeListObservedRuns(db, 200)).filter(
    (run) =>
      run.tenant_id === tenantId &&
      (run.service_name === serviceId ||
        run.service_name === seededService?.service_name),
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
    const effectiveServiceName =
      normalizeString(service.service_name, service.service_id);

    const environmentViews = resolveEnvironmentViews(
      effectiveServiceName,
      [
        ...new Set(
          seededEnvironments
            .map((env) => normalizeString(env.environment_name))
            .filter((value) => value !== ""),
        ),
      ],
      runs,
    );

    return {
      tenant,
      service: {
        ...service,
        service_name: effectiveServiceName,
      },
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
      service: {
        ...service,
        service_name: normalizeString(service.service_name, service.service_id),
      },
      environments: [],
    };
  }
}