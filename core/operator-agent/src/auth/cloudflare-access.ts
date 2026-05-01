import type { OperatorAgentEnv } from "../types";
import type { CloudflareAccessIdentity } from "./auth-types";

function headerValue(request: Request, name: string): string {
  return request.headers.get(name)?.trim() ?? "";
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const [, payload] = token.split(".");
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeIdentity(raw: Record<string, unknown>): CloudflareAccessIdentity | null {
  const email = firstString(raw.email, raw["email_address"]);
  if (!email) return null;

  return {
    email: email.toLowerCase(),
    name: firstString(raw.name, raw["given_name"], raw["preferred_username"]),
    picture: firstString(raw.picture, raw["avatar_url"]),
    provider: firstString(raw.provider, raw["idp"]),
    providerUserId: firstString(raw.sub, raw["provider_user_id"]),
    userUuid: firstString(raw.user_uuid, raw["userUuid"]),
    raw,
  };
}

export function getCloudflareAccessIdentity(
  request: Request,
  env: OperatorAgentEnv,
): CloudflareAccessIdentity | null {
  const emailHeader = headerValue(request, "Cf-Access-Authenticated-User-Email");
  if (emailHeader) {
    return {
      email: emailHeader.toLowerCase(),
      name: headerValue(request, "Cf-Access-Authenticated-User-Name") || undefined,
      picture: headerValue(request, "Cf-Access-Authenticated-User-Picture") || undefined,
      provider: "cloudflare-access",
    };
  }

  const jwt = headerValue(request, "Cf-Access-Jwt-Assertion");
  if (jwt) {
    const payload = decodeJwtPayload(jwt);
    const identity = payload ? normalizeIdentity(payload) : null;
    if (identity) return identity;
  }

  if (env.AUTH_REQUIRED === "false") {
    return {
      email: "local-operator@local.aep",
      name: "Local Operator",
      provider: "local-dev",
    };
  }

  return null;
}
