export type MirrorChannel = "slack" | "email" | "jira";
export type ExternalAdapterKind = MirrorChannel;

export type MirrorTarget =
  | {
      kind: "slack";
      channelId: string;
    }
  | {
      kind: "email";
      recipientGroup: string;
    };

export type MirrorRoutingInput = {
  threadId: string;
  threadType?: string;
  taskId?: string;
  taskType?: string;
  teamId?: string;
  subject?: string;
  messageType: "task" | "escalation" | "coordination";
  senderEmployeeId: string;
  humanVisibilityRequired: boolean;
};

export type MirrorDispatchInput = {
  messageId: string;
  threadId: string;
  body: string;
  subject?: string;
  senderEmployeeId: string;
  createdAt: string;
  routing: MirrorRoutingInput;
};

export type MirrorDeliveryStatus = "delivered" | "failed" | "skipped";

export type MirrorDeliveryRecord = {
  id: string;
  messageId: string;
  threadId: string;
  channel: MirrorChannel;
  target: string;
  status: MirrorDeliveryStatus;
  externalMessageId?: string;
  failureCode?: string;
  failureReason?: string;
  createdAt: string;
};

export type ExternalThreadProjection = {
  id: string;
  threadId: string;
  channel: MirrorChannel;
  target: string;
  externalThreadId: string;
  createdAt: string;
  updatedAt: string;
};

export type ExternalMessageProjection = {
  id: string;
  messageId: string;
  threadId: string;
  channel: MirrorChannel;
  target: string;
  externalThreadId: string;
  externalMessageId: string;
  createdAt: string;
};

export type ExternalCollaborationSurface =
  | "thread_projection"
  | "message_projection"
  | "inbound_reply"
  | "external_action"
  | "ticket_projection"
  | "status_signal";

export type CanonicalExternalResource =
  | "thread"
  | "message"
  | "task"
  | "project"
  | "approval"
  | "escalation";

export type MirrorTransportSuccess = {
  ok: true;
  externalThreadId: string;
  externalMessageId: string;
};

export type MirrorTransportFailure = {
  ok: false;
  code: string;
  reason: string;
};