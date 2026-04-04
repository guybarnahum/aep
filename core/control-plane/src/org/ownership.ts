export type TeamOwnership = {
  team_id: string;
  owns_routes: string[];
};

export const TEAM_WEBSITE_ID = "team_website";

const READ_SURFACE_ROUTES = [
  "/tenants",
  "/companies",
  "/teams",
  "/services",
];

export function getWebsiteTeamOwnership(): TeamOwnership {
  return {
    team_id: TEAM_WEBSITE_ID,
    owns_routes: READ_SURFACE_ROUTES,
  };
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

  return null;
}