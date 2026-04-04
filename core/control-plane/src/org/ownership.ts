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