import type { ProductSurface } from "./product-initiative-contracts";

export const EXTERNAL_SURFACE_KINDS = [
  "marketing_site",
  "customer_intake",
  "public_progress",
] as const;

export type ExternalSurfaceKind = (typeof EXTERNAL_SURFACE_KINDS)[number];

export const EXTERNAL_SURFACE_ACTIONS = [
  "submit_intake",
  "view_public_progress",
  "request_contact",
  "view_public_artifact",
] as const;

export type ExternalSurfaceAction = (typeof EXTERNAL_SURFACE_ACTIONS)[number];

export type ExternalSurfaceContract = {
  surfaceKind: ExternalSurfaceKind;
  productSurface: ProductSurface;
  canonicalOwner: "aep";
  externalStateOwnershipAllowed: false;
  privateCognitionExposureAllowed: false;
  directTaskMutationAllowed: false;
  directApprovalMutationAllowed: false;
  directDeploymentMutationAllowed: false;
  allowedActions: readonly ExternalSurfaceAction[];
  requiredAepRoutes: readonly string[];
  requiredContentFields: readonly string[];
};

export const EXTERNAL_SURFACE_CONTRACTS: readonly ExternalSurfaceContract[] = [
  {
    surfaceKind: "marketing_site",
    productSurface: "website_bundle",
    canonicalOwner: "aep",
    externalStateOwnershipAllowed: false,
    privateCognitionExposureAllowed: false,
    directTaskMutationAllowed: false,
    directApprovalMutationAllowed: false,
    directDeploymentMutationAllowed: false,
    allowedActions: ["submit_intake", "request_contact", "view_public_artifact"],
    requiredAepRoutes: ["POST /agent/intake"],
    requiredContentFields: [
      "externalSurfaceKind",
      "productSurface",
      "stateOwnership",
      "allowedActions",
      "aepRoutes",
      "publicDataPolicy",
    ],
  },
  {
    surfaceKind: "customer_intake",
    productSurface: "customer_intake",
    canonicalOwner: "aep",
    externalStateOwnershipAllowed: false,
    privateCognitionExposureAllowed: false,
    directTaskMutationAllowed: false,
    directApprovalMutationAllowed: false,
    directDeploymentMutationAllowed: false,
    allowedActions: ["submit_intake", "request_contact"],
    requiredAepRoutes: ["POST /agent/intake"],
    requiredContentFields: [
      "externalSurfaceKind",
      "productSurface",
      "stateOwnership",
      "allowedActions",
      "aepRoutes",
      "publicDataPolicy",
    ],
  },
  {
    surfaceKind: "public_progress",
    productSurface: "public_progress",
    canonicalOwner: "aep",
    externalStateOwnershipAllowed: false,
    privateCognitionExposureAllowed: false,
    directTaskMutationAllowed: false,
    directApprovalMutationAllowed: false,
    directDeploymentMutationAllowed: false,
    allowedActions: ["view_public_progress", "view_public_artifact"],
    requiredAepRoutes: [],
    requiredContentFields: [
      "externalSurfaceKind",
      "productSurface",
      "stateOwnership",
      "allowedActions",
      "publicDataPolicy",
    ],
  },
] as const;

export class ExternalSurfaceValidationError extends Error {
  readonly code:
    | "unsupported_external_surface_kind"
    | "surface_product_mismatch"
    | "missing_required_surface_field"
    | "invalid_surface_state_ownership"
    | "private_cognition_exposure"
    | "disallowed_external_action"
    | "missing_required_aep_route"
    | "direct_mutation_route_not_allowed";
  readonly field?: string;

  constructor(args: {
    code: ExternalSurfaceValidationError["code"];
    message: string;
    field?: string;
  }) {
    super(args.message);
    this.name = "ExternalSurfaceValidationError";
    this.code = args.code;
    this.field = args.field;
  }
}

export function parseExternalSurfaceKind(
  value: unknown,
): ExternalSurfaceKind | undefined {
  return typeof value === "string" &&
    EXTERNAL_SURFACE_KINDS.includes(value as ExternalSurfaceKind)
    ? (value as ExternalSurfaceKind)
    : undefined;
}

export function getExternalSurfaceContract(
  surfaceKind: ExternalSurfaceKind,
): ExternalSurfaceContract {
  const contract = EXTERNAL_SURFACE_CONTRACTS.find(
    (candidate) => candidate.surfaceKind === surfaceKind,
  );
  if (!contract) {
    throw new ExternalSurfaceValidationError({
      code: "unsupported_external_surface_kind",
      message: `Unsupported externalSurfaceKind: ${surfaceKind}`,
      field: "externalSurfaceKind",
    });
  }
  return contract;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function assertNoDirectMutationRoutes(routes: readonly string[]): void {
  const deniedFragments = [
    "/agent/tasks",
    "/agent/approvals",
    "/agent/product-deployments",
    "/agent/employees",
    "/agent/staffing",
  ];

  for (const route of routes) {
    for (const denied of deniedFragments) {
      if (route.includes(denied) && !route.startsWith("GET ")) {
        throw new ExternalSurfaceValidationError({
          code: "direct_mutation_route_not_allowed",
          message: `External surfaces must not directly mutate canonical state through ${route}`,
          field: "aepRoutes",
        });
      }
    }
  }
}

export function validateExternalSurfaceContent(
  content: Record<string, unknown>,
): void {
  const rawSurfaceKind = content.externalSurfaceKind;
  if (
    typeof rawSurfaceKind === "undefined" ||
    rawSurfaceKind === null ||
    rawSurfaceKind === ""
  ) {
    return;
  }

  const surfaceKind = parseExternalSurfaceKind(rawSurfaceKind);
  if (!surfaceKind) {
    throw new ExternalSurfaceValidationError({
      code: "unsupported_external_surface_kind",
      message: `Unsupported externalSurfaceKind: ${String(rawSurfaceKind)}`,
      field: "externalSurfaceKind",
    });
  }

  const contract = getExternalSurfaceContract(surfaceKind);

  for (const field of contract.requiredContentFields) {
    const value = content[field];
    if (typeof value === "undefined" || value === null || value === "") {
      throw new ExternalSurfaceValidationError({
        code: "missing_required_surface_field",
        message: `${surfaceKind} external surface missing required field: ${field}`,
        field,
      });
    }
  }

  if (content.productSurface !== contract.productSurface) {
    throw new ExternalSurfaceValidationError({
      code: "surface_product_mismatch",
      message: `${surfaceKind} external surface must use productSurface ${contract.productSurface}`,
      field: "productSurface",
    });
  }

  if (content.stateOwnership !== "aep") {
    throw new ExternalSurfaceValidationError({
      code: "invalid_surface_state_ownership",
      message: "External surfaces must declare stateOwnership as aep",
      field: "stateOwnership",
    });
  }

  if (
    content.privateCognitionExposureAllowed === true ||
    content.exposesPrivateCognition === true ||
    content.promptInternalsExposed === true
  ) {
    throw new ExternalSurfaceValidationError({
      code: "private_cognition_exposure",
      message: "External surfaces must not expose private cognition or prompt internals",
      field: "publicDataPolicy",
    });
  }

  const allowedActions = asStringArray(content.allowedActions);
  for (const action of allowedActions) {
    if (!contract.allowedActions.includes(action as ExternalSurfaceAction)) {
      throw new ExternalSurfaceValidationError({
        code: "disallowed_external_action",
        message: `${surfaceKind} external surface cannot expose action: ${action}`,
        field: "allowedActions",
      });
    }
  }

  const aepRoutes = asStringArray(content.aepRoutes);
  for (const requiredRoute of contract.requiredAepRoutes) {
    if (!aepRoutes.includes(requiredRoute)) {
      throw new ExternalSurfaceValidationError({
        code: "missing_required_aep_route",
        message: `${surfaceKind} external surface must route through ${requiredRoute}`,
        field: "aepRoutes",
      });
    }
  }

  assertNoDirectMutationRoutes(aepRoutes);
}
