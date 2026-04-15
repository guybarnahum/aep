export type InboundExternalMessage = {
  channel: "slack" | "email";
  externalThreadId: string;
  externalMessageId: string;
  externalAuthorId?: string;
  externalReceivedAt: string;
  subject?: string;
  body: string;
  target?: string;
};