import type { ExternalActionEnvelope } from "./inbound-action-types";
import type { InboundExternalMessage } from "./inbound-types";
import type {
  CanonicalExternalResource,
  ExternalAdapterKind,
  ExternalCollaborationSurface,
  ExternalMessageProjection,
  ExternalThreadProjection,
  MirrorDeliveryRecord,
} from "./types";

export type ExternalPolicyEnforcementPoint =
  | "mirror_routing"
  | "delivery_configuration"
  | "inbound_correlation"
  | "external_actor_policy"
  | "external_action_policy"
  | "canonical_route";

export type ExternalAdapterContract = {
  adapter: ExternalAdapterKind;
  implemented: boolean;
  surfaces: ExternalCollaborationSurface[];
  canonicalResources: CanonicalExternalResource[];
  ownsCanonicalWorkState: false;
  requiresProjectionMapping: boolean;
  idempotencyKeys: string[];
  policyEnforcement: ExternalPolicyEnforcementPoint[];
  deniedCapabilities: string[];
};

export const EXTERNAL_ADAPTER_CONTRACTS: ExternalAdapterContract[] = [
  {
    adapter: "slack",
    implemented: true,
    surfaces: ["thread_projection", "message_projection", "inbound_reply", "external_action"],
    canonicalResources: ["thread", "message", "approval", "escalation"],
    ownsCanonicalWorkState: false,
    requiresProjectionMapping: true,
    idempotencyKeys: [
      "messageId + channel + target",
      "threadId + channel + target",
      "externalMessageId",
      "externalActionId",
    ],
    policyEnforcement: [
      "mirror_routing",
      "delivery_configuration",
      "inbound_correlation",
      "external_actor_policy",
      "external_action_policy",
      "canonical_route",
    ],
    deniedCapabilities: [
      "own_task_state",
      "own_project_state",
      "own_approval_state",
      "own_escalation_state",
      "expose_private_cognition",
      "mutate_without_canonical_route",
    ],
  },
  {
    adapter: "email",
    implemented: true,
    surfaces: ["thread_projection", "message_projection", "inbound_reply", "external_action"],
    canonicalResources: ["thread", "message", "approval", "escalation"],
    ownsCanonicalWorkState: false,
    requiresProjectionMapping: true,
    idempotencyKeys: [
      "messageId + channel + target",
      "threadId + channel + target",
      "externalMessageId",
      "externalActionId",
    ],
    policyEnforcement: [
      "mirror_routing",
      "delivery_configuration",
      "inbound_correlation",
      "external_actor_policy",
      "external_action_policy",
      "canonical_route",
    ],
    deniedCapabilities: [
      "own_task_state",
      "own_project_state",
      "own_approval_state",
      "own_escalation_state",
      "expose_private_cognition",
      "mutate_without_canonical_route",
    ],
  },
  {
    adapter: "jira",
    implemented: false,
    surfaces: ["ticket_projection", "inbound_reply", "external_action"],
    canonicalResources: ["project", "task", "thread", "message"],
    ownsCanonicalWorkState: false,
    requiresProjectionMapping: true,
    idempotencyKeys: [
      "projectId/taskId/threadId + adapter + target",
      "externalTicketId",
      "externalCommentId",
      "externalActionId",
    ],
    policyEnforcement: [
      "inbound_correlation",
      "external_actor_policy",
      "external_action_policy",
      "canonical_route",
    ],
    deniedCapabilities: [
      "own_task_state",
      "own_project_state",
      "own_approval_state",
      "own_escalation_state",
      "set_canonical_status_directly",
      "expose_private_cognition",
      "mutate_without_canonical_route",
    ],
  },
];

export type ExternalThreadProjectionContract = Pick<
  ExternalThreadProjection,
  "threadId" | "channel" | "target" | "externalThreadId"
>;

export type ExternalMessageProjectionContract = Pick<
  ExternalMessageProjection,
  "messageId" | "threadId" | "channel" | "target" | "externalThreadId" | "externalMessageId"
>;

export type InboundReplyContract = Pick<
  InboundExternalMessage,
  "channel" | "externalThreadId" | "externalMessageId" | "externalAuthorId" | "body" | "target"
>;

export type ExternalActionContract = ExternalActionEnvelope;

export type ExternalDeliveryAuditContract = Pick<
  MirrorDeliveryRecord,
  "messageId" | "threadId" | "channel" | "target" | "status" | "externalMessageId" | "failureCode"
>;

export type JiraLikeTicketProjectionContract = {
  adapter: "jira";
  implemented: false;
  canonicalSource:
    | { kind: "project"; projectId: string }
    | { kind: "task"; taskId: string }
    | { kind: "thread"; threadId: string };
  externalTicketId: string;
  externalProjectKey?: string;
  externalUrl?: string;
};

export type JiraLikeInboundCommentContract = {
  adapter: "jira";
  externalTicketId: string;
  externalCommentId: string;
  externalAuthorId?: string;
  body: string;
  receivedAt: string;
};

export type JiraLikeStatusReconciliationRule = {
  externalStatus: string;
  canonicalEffect:
    | "no_op"
    | "request_manager_review"
    | "create_canonical_message"
    | "create_external_action";
  directCanonicalMutationAllowed: false;
};

export const JIRA_LIKE_STATUS_RECONCILIATION_RULES: JiraLikeStatusReconciliationRule[] = [
  {
    externalStatus: "todo",
    canonicalEffect: "no_op",
    directCanonicalMutationAllowed: false,
  },
  {
    externalStatus: "in_progress",
    canonicalEffect: "create_canonical_message",
    directCanonicalMutationAllowed: false,
  },
  {
    externalStatus: "blocked",
    canonicalEffect: "request_manager_review",
    directCanonicalMutationAllowed: false,
  },
  {
    externalStatus: "done",
    canonicalEffect: "request_manager_review",
    directCanonicalMutationAllowed: false,
  },
];

export function getExternalAdapterContract(
  adapter: ExternalAdapterKind,
): ExternalAdapterContract | undefined {
  return EXTERNAL_ADAPTER_CONTRACTS.find(
    (contract) => contract.adapter === adapter,
  );
}
