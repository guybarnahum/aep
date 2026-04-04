export type TeamOwnership = {
  team_id: string;
  owns_routes: string[];
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
    pathname === "/teams/team_validation/ownership"
  ) {
    return TEAM_VALIDATION_ID;
  }

  return null;
}