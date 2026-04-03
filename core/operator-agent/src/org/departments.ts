import type { TeamId } from "@aep/operator-agent/org/teams";

export const departments: Record<TeamId, { id: TeamId; name: string }> = {
  team_infra: {
    id: "team_infra",
    name: "AEP Infra Operations",
  },
  team_web_product: {
    id: "team_web_product",
    name: "AEP Web Product",
  },
  team_validation: {
    id: "team_validation",
    name: "AEP Validation",
  },
};
