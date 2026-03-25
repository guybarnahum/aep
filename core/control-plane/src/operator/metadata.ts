import type {
  EnvironmentSummary,
  ServiceSummary,
  TenantSummary,
} from "@aep/control-plane/operator/types";

const TENANTS: TenantSummary[] = [
  {
    tenant_id: "internal",
    name: "Internal",
    service_count: 4,
    environment_count: 3,
    source: "seeded",
  },
  {
    tenant_id: "t_demo",
    name: "Demo",
    service_count: 4,
    environment_count: 3,
    source: "seeded",
  },
];

const SERVICES: ServiceSummary[] = [
  {
    tenant_id: "internal",
    service_id: "dashboard",
    service_name: "dashboard",
    provider: "cloudflare",
    environments: ["dev", "qa", "validation"],
  },
  {
    tenant_id: "internal",
    service_id: "operator-ui",
    service_name: "operator-ui",
    provider: "cloudflare",
    environments: ["dev", "qa", "validation"],
  },
  {
    tenant_id: "internal",
    service_id: "proving-ground",
    service_name: "proving-ground",
    provider: "aws",
    environments: ["dev", "qa", "validation"],
  },
  {
    tenant_id: "internal",
    service_id: "sample-worker",
    service_name: "sample-worker",
    provider: "cloudflare",
    environments: ["dev", "qa", "validation"],
  },

  {
    tenant_id: "t_demo",
    service_id: "dashboard",
    service_name: "dashboard",
    provider: "cloudflare",
    environments: ["dev", "qa", "validation"],
  },
  {
    tenant_id: "t_demo",
    service_id: "operator-ui",
    service_name: "operator-ui",
    provider: "cloudflare",
    environments: ["dev", "qa", "validation"],
  },
  {
    tenant_id: "t_demo",
    service_id: "proving-ground",
    service_name: "proving-ground",
    provider: "aws",
    environments: ["dev", "qa", "validation"],
  },
  {
    tenant_id: "t_demo",
    service_id: "sample-worker",
    service_name: "sample-worker",
    provider: "cloudflare",
    environments: ["dev", "qa", "validation"],
  },
];

const ENVIRONMENTS: EnvironmentSummary[] = SERVICES.flatMap((service) =>
  service.environments.map((environment_name) => ({
    tenant_id: service.tenant_id,
    service_id: service.service_id,
    environment_name,
  })),
);

export function listSeededTenants(): TenantSummary[] {
  return TENANTS;
}

export function getSeededTenant(tenantId: string): TenantSummary | null {
  return TENANTS.find((tenant) => tenant.tenant_id === tenantId) ?? null;
}

export function listServicesForTenant(tenantId: string): ServiceSummary[] {
  return SERVICES.filter((service) => service.tenant_id === tenantId);
}

export function getService(
  tenantId: string,
  serviceId: string,
): ServiceSummary | null {
  return (
    SERVICES.find(
      (service) =>
        service.tenant_id === tenantId && service.service_id === serviceId,
    ) ?? null
  );
}

export function listEnvironmentsForService(
  tenantId: string,
  serviceId: string,
): EnvironmentSummary[] {
  return ENVIRONMENTS.filter(
    (environment) =>
      environment.tenant_id === tenantId &&
      environment.service_id === serviceId,
  );
}