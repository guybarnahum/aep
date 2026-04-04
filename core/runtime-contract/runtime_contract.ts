export type RuntimeTenant = {
  tenant_id: string;
  name: string;
  service_count: number;
  environment_count: number;
};

export function normalizeTenant(input: any): RuntimeTenant {
  return {
    tenant_id: String(input?.tenant_id ?? ""),
    name: String(input?.name ?? ""),
    service_count: Number(input?.service_count ?? 0),
    environment_count: Number(input?.environment_count ?? 0),
  };
}

export function assertRuntimeTenant(obj: any): RuntimeTenant {
  if (!obj || typeof obj !== "object") {
    throw new Error("invalid tenant object");
  }

  if (typeof obj.tenant_id !== "string") {
    throw new Error("invalid tenant_id");
  }

  if (typeof obj.name !== "string") {
    throw new Error("invalid tenant name");
  }

  return obj;
}