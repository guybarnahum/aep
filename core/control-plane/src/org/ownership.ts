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
  created_at?: string;
  owner_team?: string | null;
  severity?: "info" | "warn" | "failed" | "critical" | null;
  escalation_state?: "none" | "assigned" | "escalated" | null;
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
  "/validation/results/latest",
  "/validation/verdict",
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
      "severity_classification",
      "owner_team_assignment",
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
    pathname === "/validation/results" ||
    pathname.startsWith("/validation/results/") ||
    pathname === "/validation/results/latest" ||
    pathname === "/validation/verdict" ||
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

export function classifyValidationSeverity(args: {
  status: "passed" | "failed" | "warn";
  validationType:
    | "runtime_read_safety"
    | "contract_surface"
    | "ownership_surface";
}): "info" | "warn" | "failed" | "critical" {
  if (args.status === "passed") {
    return "info";
  }

  if (args.status === "warn") {
    return "warn";
  }

  if (args.validationType === "runtime_read_safety") {
    return "critical";
  }

  return "failed";
}

export function deriveEscalationState(args: {
  severity: "info" | "warn" | "failed" | "critical";
  ownerTeam: string | null;
}): "none" | "assigned" | "escalated" {
  if (args.severity === "info" || args.severity === "warn") {
    return "none";
  }

  if (args.severity === "critical") {
    return "escalated";
  }

  return args.ownerTeam ? "assigned" : "none";
}

export function deriveOwnerTeamForValidationType(
  validationType:
    | "runtime_read_safety"
    | "contract_surface"
    | "ownership_surface",
): string | null {
  if (
    validationType === "runtime_read_safety" ||
    validationType === "contract_surface" ||
    validationType === "ownership_surface"
  ) {
    return TEAM_WEBSITE_ID;
  }

  return null;
}