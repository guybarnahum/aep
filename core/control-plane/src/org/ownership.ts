export type TeamOwnership = {
  team_id: string;
  owns_routes: string[];
};

export type ValidationEmployee = {
  employee_id: string;
  team_id: string;
  role: "runner" | "auditor" | "scheduler";
  status: "active";
  capabilities: string[];
};

export type ValidationResult = {
  validation_id: string;
  team_id: string;
  status: "passed" | "failed" | "warn";
  validation_type:
    | "runtime_read_safety"
    | "contract_surface"
    | "ownership_surface";
  executed_by: string;
  summary: string;
};

export const TEAM_WEBSITE_ID = "team_website";
export const TEAM_VALIDATION_ID = "team_validation";

const WEBSITE_READ_SURFACE_ROUTES = [
  "/tenants",
  "/companies",
  "/teams",
  "/services",
];

const VALIDATION_SURFACE_ROUTES = [
  "/teams/team_validation/ownership",
  "/validation",
  "/validation/employees",
  "/validation/employees/:employeeId",
  "/validation/results",
  "/validation/results/:validationId",
];

const VALIDATION_EMPLOYEES: ValidationEmployee[] = [
  {
    employee_id: "employee_validation_runner",
    team_id: TEAM_VALIDATION_ID,
    role: "runner",
    status: "active",
    capabilities: [
      "runtime_read_safety_validation",
      "contract_surface_validation",
    ],
  },
  {
    employee_id: "employee_validation_auditor",
    team_id: TEAM_VALIDATION_ID,
    role: "auditor",
    status: "active",
    capabilities: [
      "ownership_surface_validation",
      "validation_result_auditing",
    ],
  },
  {
    employee_id: "employee_validation_scheduler",
    team_id: TEAM_VALIDATION_ID,
    role: "scheduler",
    status: "active",
    capabilities: [
      "validation_dispatch_planning",
      "validation_lane_scheduling",
    ],
  },
];

const VALIDATION_RESULTS: ValidationResult[] = [
  {
    validation_id: "validation_runtime_read_safety",
    team_id: TEAM_VALIDATION_ID,
    status: "passed",
    validation_type: "runtime_read_safety",
    executed_by: "employee_validation_runner",
    summary: "Runtime read surface returned stable JSON responses.",
  },
  {
    validation_id: "validation_contract_surface",
    team_id: TEAM_VALIDATION_ID,
    status: "passed",
    validation_type: "contract_surface",
    executed_by: "employee_validation_runner",
    summary:
      "Contract-governed list surfaces normalized and asserted successfully.",
  },
  {
    validation_id: "validation_ownership_surface",
    team_id: TEAM_VALIDATION_ID,
    status: "passed",
    validation_type: "ownership_surface",
    executed_by: "employee_validation_auditor",
    summary:
      "Owned route discovery and validation team ownership surfaces resolved correctly.",
  },
];

export function getWebsiteTeamOwnership(): TeamOwnership {
  return {
    team_id: TEAM_WEBSITE_ID,
    owns_routes: WEBSITE_READ_SURFACE_ROUTES,
  };
}

export function getValidationTeamOwnership(): TeamOwnership {
  return {
    team_id: TEAM_VALIDATION_ID,
    owns_routes: VALIDATION_SURFACE_ROUTES,
  };
}

export function getTeamOwnership(teamId: string): TeamOwnership | null {
  if (teamId === TEAM_WEBSITE_ID) {
    return getWebsiteTeamOwnership();
  }

  if (teamId === TEAM_VALIDATION_ID) {
    return getValidationTeamOwnership();
  }

  return null;
}

export function getOwnerForRoute(pathname: string): string | null {
  if (
    pathname === "/tenants" ||
    pathname === "/companies" ||
    pathname === "/teams" ||
    pathname === "/services"
  ) {
    return TEAM_WEBSITE_ID;
  }

  if (
    pathname === "/validation" ||
    pathname === "/validation/employees" ||
    pathname.startsWith("/validation/employees/") ||
    pathname === "/validation/results" ||
    pathname.startsWith("/validation/results/") ||
    pathname === "/teams/team_validation/ownership"
  ) {
    return TEAM_VALIDATION_ID;
  }

  return null;
}

export function listValidationEmployees(): ValidationEmployee[] {
  return VALIDATION_EMPLOYEES.map((employee) => ({ ...employee }));
}

export function getValidationEmployee(
  employeeId: string,
): ValidationEmployee | null {
  return (
    VALIDATION_EMPLOYEES.find(
      (employee) => employee.employee_id === employeeId,
    ) ?? null
  );
}

export function listValidationResults(): ValidationResult[] {
  return VALIDATION_RESULTS.map((result) => ({ ...result }));
}

export function getValidationResult(
  validationId: string,
): ValidationResult | null {
  return (
    VALIDATION_RESULTS.find(
      (result) => result.validation_id === validationId,
    ) ?? null
  );
}