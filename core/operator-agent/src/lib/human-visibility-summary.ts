import type {
  Decision,
  EmployeeMessage,
  MessageThread,
  TaskArtifact,
} from "@aep/operator-agent/lib/store-types";
import type {
  ExternalThreadProjection,
} from "@aep/operator-agent/adapters/types";
import type {
  ThreadExternalInteractionPolicy,
} from "@aep/operator-agent/lib/store-types";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function artifactKind(artifact: TaskArtifact): string | undefined {
  const content = asRecord(artifact.content);
  return typeof content?.kind === "string" ? content.kind : undefined;
}

function latestArtifactByKind(
  artifacts: TaskArtifact[],
  kind: string,
): TaskArtifact | undefined {
  const matches = artifacts.filter((artifact) => artifactKind(artifact) === kind);
  return matches.length > 0 ? matches[matches.length - 1] : undefined;
}

function latestPublicRationalePublication(
  messages: EmployeeMessage[],
): EmployeeMessage | undefined {
  const matches = messages.filter((message) => {
    const payload = asRecord(message.payload);
    return payload?.kind === "public_rationale_publication";
  });
  return matches.length > 0 ? matches[matches.length - 1] : undefined;
}

export function summarizeTaskVisibility(args: {
  artifacts: TaskArtifact[];
  decision: Decision | null;
  relatedThreads: MessageThread[];
}) {
  const planArtifacts = args.artifacts.filter((artifact) => artifact.artifactType === "plan");
  const resultArtifacts = args.artifacts.filter((artifact) => artifact.artifactType === "result");
  const evidenceArtifacts = args.artifacts.filter((artifact) => artifact.artifactType === "evidence");

  const latestPublicRationale = latestArtifactByKind(args.artifacts, "public_rationale");
  const latestValidationResult = latestArtifactByKind(args.artifacts, "validation_result");

  const latestValidationContent = latestValidationResult
    ? asRecord(latestValidationResult.content)
    : undefined;

  return {
    artifactCounts: {
      plan: planArtifacts.length,
      result: resultArtifacts.length,
      evidence: evidenceArtifacts.length,
    },
    hasPlanArtifact: planArtifacts.length > 0,
    hasPublicRationaleArtifact: Boolean(latestPublicRationale),
    publicRationaleArtifactId: latestPublicRationale?.id,
    hasValidationResultArtifact: Boolean(latestValidationResult),
    validationResultArtifactId: latestValidationResult?.id,
    latestValidationStatus:
      typeof latestValidationContent?.status === "string"
        ? latestValidationContent.status
        : undefined,
    latestDecisionVerdict: args.decision?.verdict,
    latestDecisionEmployeeId: args.decision?.employeeId,
    relatedThreadCount: args.relatedThreads.length,
    relatedApprovalThreadCount: args.relatedThreads.filter((thread) => Boolean(thread.relatedApprovalId)).length,
    relatedEscalationThreadCount: args.relatedThreads.filter((thread) => Boolean(thread.relatedEscalationId)).length,
  };
}

export function summarizeThreadVisibility(args: {
  thread: MessageThread;
  messages: EmployeeMessage[];
  externalThreadProjections: ExternalThreadProjection[];
  externalInteractionPolicy: ThreadExternalInteractionPolicy | null;
}) {
  const publicRationalePublication = latestPublicRationalePublication(args.messages);
  const publicationPayload = publicRationalePublication
    ? asRecord(publicRationalePublication.payload)
    : undefined;

  const approvalActionCount = args.messages.filter(
    (message) =>
      message.responseActionType === "approve_approval"
      || message.responseActionType === "reject_approval",
  ).length;

  const escalationActionCount = args.messages.filter(
    (message) =>
      message.responseActionType === "acknowledge_escalation"
      || message.responseActionType === "resolve_escalation",
  ).length;

  return {
    relatedTaskId: args.thread.relatedTaskId,
    relatedApprovalId: args.thread.relatedApprovalId,
    relatedEscalationId: args.thread.relatedEscalationId,
    messageCount: args.messages.length,
    hasPublicRationalePublication: Boolean(publicRationalePublication),
    latestPublicRationalePresentationStyle:
      typeof publicationPayload?.presentationStyle === "string"
        ? publicationPayload.presentationStyle
        : undefined,
    approvalActionCount,
    escalationActionCount,
    externalProjectionCount: args.externalThreadProjections.length,
    inboundRepliesAllowed: args.externalInteractionPolicy?.inboundRepliesAllowed,
    externalActionsAllowed: args.externalInteractionPolicy?.externalActionsAllowed,
  };
}