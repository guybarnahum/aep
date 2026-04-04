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

export type RuntimeCompany = {
  company_id: string;
  name: string;
};

export function normalizeCompany(input: any): RuntimeCompany {
  return {
    company_id: String(input?.company_id ?? input?.id ?? ""),
    name: String(input?.name ?? ""),
  };
}

export function assertRuntimeCompany(obj: any): RuntimeCompany {
  if (!obj || typeof obj !== "object") {
    throw new Error("invalid company object");
  }

  if (typeof obj.company_id !== "string") {
    throw new Error("invalid company_id");
  }

  return obj;
}

export type RuntimeTeam = {
  team_id: string;
  name: string;
  company_id?: string;
};

export function normalizeTeam(input: any): RuntimeTeam {
  return {
    team_id: String(input?.team_id ?? input?.id ?? ""),
    name: String(input?.name ?? ""),
    company_id:
      input?.company_id === null || input?.company_id === undefined
        ? undefined
        : String(input.company_id),
  };
}

export function assertRuntimeTeam(obj: any): RuntimeTeam {
  if (!obj || typeof obj !== "object") {
    throw new Error("invalid team object");
  }

  if (typeof obj.team_id !== "string") {
    throw new Error("invalid team_id");
  }

  return obj;
}

export type RuntimeService = {
  service_id: string;
  service_name: string;
  provider: string | null;
};

export function normalizeService(input: any): RuntimeService {
  return {
    service_id: String(input?.service_id ?? input?.id ?? ""),
    service_name: String(input?.service_name ?? input?.name ?? ""),
    provider:
      input?.provider === null || input?.provider === undefined
        ? null
        : String(input.provider),
  };
}

export function assertRuntimeService(obj: any): RuntimeService {
  if (!obj || typeof obj !== "object") {
    throw new Error("invalid service object");
  }

  if (typeof obj.service_id !== "string") {
    throw new Error("invalid service_id");
  }

  return obj;
}