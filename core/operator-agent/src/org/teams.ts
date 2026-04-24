export const TEAM_INFRA = "team_infra" as const;
export const TEAM_WEB_PRODUCT = "team_web_product" as const;
export const TEAM_VALIDATION = "team_validation" as const;

export type TeamId =
  | typeof TEAM_INFRA
  | typeof TEAM_WEB_PRODUCT
  | typeof TEAM_VALIDATION;

export const TEAM_IDS: TeamId[] = [
  TEAM_INFRA,
  TEAM_WEB_PRODUCT,
  TEAM_VALIDATION,
];

export function isTeamId(value: string): value is TeamId {
  return TEAM_IDS.includes(value as TeamId);
}