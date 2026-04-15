export async function sendEmailMirror(args: {
  recipientGroup: string;
  subject: string;
  body: string;
}): Promise<{ ok: true; externalMessageId?: string } | { ok: false; code: string; reason: string }> {
  void args;
  return {
    ok: false,
    code: "email_not_configured",
    reason: "Email mirroring transport is not configured in PR10A",
  };
}