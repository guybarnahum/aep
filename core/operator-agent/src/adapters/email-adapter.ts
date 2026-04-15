import type { MirrorTransportFailure, MirrorTransportSuccess } from "./types";

export async function sendEmailMirror(args: {
  recipientGroup: string;
  subject: string;
  body: string;
  externalThreadId?: string;
}): Promise<MirrorTransportSuccess | MirrorTransportFailure> {
  void args;
  return {
    ok: false,
    code: "email_not_configured",
    reason: "Email mirroring transport is not configured in PR10A",
  };
}