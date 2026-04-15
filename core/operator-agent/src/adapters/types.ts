export type MirrorChannel = "slack" | "email";

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