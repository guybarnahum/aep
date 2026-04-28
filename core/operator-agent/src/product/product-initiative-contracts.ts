import type { CanonicalTaskType } from "../lib/task-contracts";
import { TEAM_INFRA, TEAM_VALIDATION, TEAM_WEB_PRODUCT, type TeamId } from "../org/teams";

export const PRODUCT_INITIATIVE_KINDS = [
  "marketing_site",
  "customer_intake_surface",
  "tenant_conversion_surface",
] as const;

export type ProductInitiativeKind = (typeof PRODUCT_INITIATIVE_KINDS)[number];

export const PRODUCT_SURFACES = [
  "website_bundle",
  "customer_intake",
  "public_progress",
] as const;

export type ProductSurface = (typeof PRODUCT_SURFACES)[number];

export const PRODUCT_EXTERNAL_VISIBILITIES = [
  "internal_only",
  "external_safe",
] as const;

export type ProductExternalVisibility =
  (typeof PRODUCT_EXTERNAL_VISIBILITIES)[number];

export type ProductInitiativeContract = {
  initiativeKind: ProductInitiativeKind;
  canonicalContainer: "project";
  requiredTeams: readonly TeamId[];
  seedTaskTypes: readonly CanonicalTaskType[];
  deploymentApprovalRequired: boolean;
  externalExposureAllowed: boolean;
  noParallelProductStore: true;
  noDirectImplementation: true;
  noExternalStateOwnership: true;
  privateCognitionExposureAllowed: false;
};

export const PRODUCT_INITIATIVE_CONTRACTS: readonly ProductInitiativeContract[] = [
  {
    initiativeKind: "marketing_site",
    canonicalContainer: "project",
    requiredTeams: [TEAM_WEB_PRODUCT, TEAM_INFRA, TEAM_VALIDATION],
    seedTaskTypes: [
      "project_planning",
      "requirements_definition",
      "task_graph_planning",
    ],
    deploymentApprovalRequired: true,
    externalExposureAllowed: true,
    noParallelProductStore: true,
    noDirectImplementation: true,
    noExternalStateOwnership: true,
    privateCognitionExposureAllowed: false,
  },
  {
    initiativeKind: "customer_intake_surface",
    canonicalContainer: "project",
    requiredTeams: [TEAM_WEB_PRODUCT, TEAM_INFRA, TEAM_VALIDATION],
    seedTaskTypes: [
      "project_planning",
      "requirements_definition",
      "task_graph_planning",
    ],
    deploymentApprovalRequired: true,
    externalExposureAllowed: true,
    noParallelProductStore: true,
    noDirectImplementation: true,
    noExternalStateOwnership: true,
    privateCognitionExposureAllowed: false,
  },
  {
    initiativeKind: "tenant_conversion_surface",
    canonicalContainer: "project",
    requiredTeams: [TEAM_WEB_PRODUCT, TEAM_INFRA, TEAM_VALIDATION],
    seedTaskTypes: [
      "project_planning",
      "requirements_definition",
      "task_graph_planning",
    ],
    deploymentApprovalRequired: true,
    externalExposureAllowed: true,
    noParallelProductStore: true,
    noDirectImplementation: true,
    noExternalStateOwnership: true,
    privateCognitionExposureAllowed: false,
  },
] as const;

export function parseProductInitiativeKind(
  value: unknown,
): ProductInitiativeKind | undefined {
  return typeof value === "string" &&
    PRODUCT_INITIATIVE_KINDS.includes(value as ProductInitiativeKind)
    ? (value as ProductInitiativeKind)
    : undefined;
}

export function parseProductSurface(value: unknown): ProductSurface | undefined {
  return typeof value === "string" &&
    PRODUCT_SURFACES.includes(value as ProductSurface)
    ? (value as ProductSurface)
    : undefined;
}

export function parseProductExternalVisibility(
  value: unknown,
): ProductExternalVisibility | undefined {
  return typeof value === "string" &&
    PRODUCT_EXTERNAL_VISIBILITIES.includes(value as ProductExternalVisibility)
    ? (value as ProductExternalVisibility)
    : undefined;
}

export function getProductInitiativeContract(
  initiativeKind: ProductInitiativeKind,
): ProductInitiativeContract {
  const contract = PRODUCT_INITIATIVE_CONTRACTS.find(
    (candidate) => candidate.initiativeKind === initiativeKind,
  );
  if (!contract) {
    throw new Error(`Missing product initiative contract: ${initiativeKind}`);
  }
  return contract;
}
