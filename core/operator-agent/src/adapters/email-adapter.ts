import type { MirrorTransportFailure, MirrorTransportSuccess } from "./types";

export type EmailMirrorPayload = {
  recipientGroup: string;
  subject: string;
  body: string;
  headers: {
    "x-aep-external-thread-id"?: string;
  };
};

function normalizeNonEmpty(value: string): string {
  return value.trim();
}

export function isPlaceholderEmailTarget(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized.includes("example.com") ||
    normalized.includes("example.org") ||
    normalized.includes("example.net")
  );
}

export function buildEmailMirrorPayload(args: {
  recipientGroup: string;
  subject: string;
  body: string;
  externalThreadId?: string;
}): EmailMirrorPayload | MirrorTransportFailure {
  const recipientGroup = normalizeNonEmpty(args.recipientGroup);
  const subject = normalizeNonEmpty(args.subject);
  const body = normalizeNonEmpty(args.body);

  if (isPlaceholderEmailTarget(recipientGroup)) {
    return {
      ok: false,
      code: "email_target_invalid",
      reason: "Email mirror target is missing or uses a placeholder domain",
    };
  }

  if (!subject) {
    return {
      ok: false,
      code: "email_subject_missing",
      reason: "Email mirror subject is required",
    };
  }

  if (!body) {
    return {
      ok: false,
      code: "email_body_missing",
      reason: "Email mirror body is required",
    };
  }

  return {
    recipientGroup,
    subject,
    body,
    headers: {
      "x-aep-external-thread-id": args.externalThreadId?.trim() || undefined,
    },
  };
}

export async function sendEmailMirror(args: {
  recipientGroup: string;
  subject: string;
  body: string;
  externalThreadId?: string;
}): Promise<MirrorTransportSuccess | MirrorTransportFailure> {
  const payload = buildEmailMirrorPayload(args);

  if ("ok" in payload && payload.ok === false) {
    return payload;
  }

  void payload;

  return {
    ok: false,
    code: "email_not_configured",
    reason: "Email mirroring transport is not configured",
  };
}