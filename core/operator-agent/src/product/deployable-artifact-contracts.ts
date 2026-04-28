import type { TaskArtifactType } from "../lib/store-types";
import type { ProductSurface } from "./product-initiative-contracts";
import {
  ExternalSurfaceValidationError,
  validateExternalSurfaceContent,
} from "./external-surface-contracts";

export const DEPLOYABLE_ARTIFACT_KINDS = [
  "github_repository",
  "website_bundle",
  "deployment_candidate",
] as const;

export type DeployableArtifactKind =
  (typeof DEPLOYABLE_ARTIFACT_KINDS)[number];

export const DEPLOYABLE_ARTIFACT_STATES = [
  "draft",
  "ready_for_validation",
  "validated",
  "ready_for_deployment",
] as const;

export type DeployableArtifactState =
  (typeof DEPLOYABLE_ARTIFACT_STATES)[number];

export type DeployableArtifactContract = {
  kind: DeployableArtifactKind;
  canonicalContainer: "task_artifact";
  allowedArtifactTypes: readonly TaskArtifactType[];
  requiredContentFields: readonly string[];
  deploymentRecordRequiredBeforeExposure: true;
  approvalRequiredBeforeExternalExposure: true;
  noDirectDeployment: true;
  noExternalStateOwnership: true;
  privateCognitionExposureAllowed: false;
};

export const DEPLOYABLE_ARTIFACT_CONTRACTS: readonly DeployableArtifactContract[] = [
  {
    kind: "github_repository",
    canonicalContainer: "task_artifact",
    allowedArtifactTypes: ["result", "evidence"],
    requiredContentFields: [
      "deployableArtifactKind",
      "projectId",
      "productSurface",
      "state",
      "repository",
      "stateOwnership",
    ],
    deploymentRecordRequiredBeforeExposure: true,
    approvalRequiredBeforeExternalExposure: true,
    noDirectDeployment: true,
    noExternalStateOwnership: true,
    privateCognitionExposureAllowed: false,
  },
  {
    kind: "website_bundle",
    canonicalContainer: "task_artifact",
    allowedArtifactTypes: ["result", "evidence"],
    requiredContentFields: [
      "deployableArtifactKind",
      "projectId",
      "productSurface",
      "state",
      "bundle",
      "stateOwnership",
    ],
    deploymentRecordRequiredBeforeExposure: true,
    approvalRequiredBeforeExternalExposure: true,
    noDirectDeployment: true,
    noExternalStateOwnership: true,
    privateCognitionExposureAllowed: false,
  },
  {
    kind: "deployment_candidate",
    canonicalContainer: "task_artifact",
    allowedArtifactTypes: ["evidence"],
    requiredContentFields: [
      "deployableArtifactKind",
      "projectId",
      "productSurface",
      "state",
      "artifactRef",
      "deploymentTarget",
      "stateOwnership",
    ],
    deploymentRecordRequiredBeforeExposure: true,
    approvalRequiredBeforeExternalExposure: true,
    noDirectDeployment: true,
    noExternalStateOwnership: true,
    privateCognitionExposureAllowed: false,
  },
] as const;

export class DeployableArtifactValidationError extends Error {
  readonly code:
    | "unsupported_deployable_artifact_kind"
    | "invalid_artifact_type"
    | "missing_required_content_field"
    | "invalid_state"
    | "invalid_state_ownership";
  readonly field?: string;

  constructor(args: {
    code: DeployableArtifactValidationError["code"];
    message: string;
    field?: string;
  }) {
    super(args.message);
    this.name = "DeployableArtifactValidationError";
    this.code = args.code;
    this.field = args.field;
  }
}

export type DeployableArtifactContractValidationError =
  | DeployableArtifactValidationError
  | ExternalSurfaceValidationError;

export function parseDeployableArtifactKind(
  value: unknown,
): DeployableArtifactKind | undefined {
  return typeof value === "string" &&
    DEPLOYABLE_ARTIFACT_KINDS.includes(value as DeployableArtifactKind)
    ? (value as DeployableArtifactKind)
    : undefined;
}

export function getDeployableArtifactContract(
  kind: DeployableArtifactKind,
): DeployableArtifactContract {
  const contract = DEPLOYABLE_ARTIFACT_CONTRACTS.find(
    (candidate) => candidate.kind === kind,
  );
  if (!contract) {
    throw new DeployableArtifactValidationError({
      code: "unsupported_deployable_artifact_kind",
      message: `Unsupported deployableArtifactKind: ${kind}`,
      field: "deployableArtifactKind",
    });
  }
  return contract;
}

export function validateDeployableArtifactContent(args: {
  artifactType: TaskArtifactType;
  content: Record<string, unknown>;
}): void {
  const rawKind = args.content.deployableArtifactKind;
  if (typeof rawKind === "undefined" || rawKind === null || rawKind === "") {
    return;
  }

  const kind = parseDeployableArtifactKind(rawKind);
  if (!kind) {
    throw new DeployableArtifactValidationError({
      code: "unsupported_deployable_artifact_kind",
      message: `Unsupported deployableArtifactKind: ${String(rawKind)}`,
      field: "deployableArtifactKind",
    });
  }

  const contract = getDeployableArtifactContract(kind);
  if (!contract.allowedArtifactTypes.includes(args.artifactType)) {
    throw new DeployableArtifactValidationError({
      code: "invalid_artifact_type",
      message: `${kind} deployable artifacts must use artifactType ${contract.allowedArtifactTypes.join(" or ")}`,
      field: "artifactType",
    });
  }

  for (const field of contract.requiredContentFields) {
    const value = args.content[field];
    if (typeof value === "undefined" || value === null || value === "") {
      throw new DeployableArtifactValidationError({
        code: "missing_required_content_field",
        message: `${kind} deployable artifact missing required content field: ${field}`,
        field,
      });
    }
  }

  if (
    typeof args.content.state !== "string" ||
    !DEPLOYABLE_ARTIFACT_STATES.includes(args.content.state as DeployableArtifactState)
  ) {
    throw new DeployableArtifactValidationError({
      code: "invalid_state",
      message: `${kind} deployable artifact has unsupported state: ${String(args.content.state)}`,
      field: "state",
    });
  }

  if (args.content.stateOwnership !== "aep") {
    throw new DeployableArtifactValidationError({
      code: "invalid_state_ownership",
      message: "Deployable artifacts must declare stateOwnership as aep",
      field: "stateOwnership",
    });
  }

  const productSurface = args.content.productSurface as ProductSurface;
  if (typeof productSurface !== "string" || !productSurface.trim()) {
    throw new DeployableArtifactValidationError({
      code: "missing_required_content_field",
      message: `${kind} deployable artifact missing required content field: productSurface`,
      field: "productSurface",
    });
  }

  validateExternalSurfaceContent(args.content);
}

export { ExternalSurfaceValidationError };