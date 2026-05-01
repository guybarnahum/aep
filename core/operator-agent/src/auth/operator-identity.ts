import type { OperatorAgentEnv } from "../types";
import type {
  CloudflareAccessIdentity,
  OperatorIdentity,
  OperatorPermission,
} from "./auth-types";

const DEFAULT_OPERATOR_PERMISSIONS: OperatorPermission[] = [
  "product.lifecycle.request",
];

const ADMIN_OPERATOR_PERMISSIONS: OperatorPermission[] = [
  "product.lifecycle.request",
  "product.lifecycle.approve",
  "product.lifecycle.execute",
  "deployment.request",
  "deployment.approve",
  "deployment.execute",
  "qa.cleanup",
  "admin.runtime",
];

function parseEmailSet(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function operatorIdFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "operator";
  const slug = local
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `operator:${slug || "user"}`;
}

export function resolveOperatorIdentity(
  identity: CloudflareAccessIdentity,
  env: OperatorAgentEnv,
): OperatorIdentity | null {
  const email = identity.email.toLowerCase();
  const allowlist = parseEmailSet(env.OPERATOR_ALLOWLIST);
  const admins = parseEmailSet(env.OPERATOR_ADMIN_EMAILS);

  if (allowlist.size > 0 && !allowlist.has(email)) {
    return null;
  }

  return {
    operatorId: operatorIdFromEmail(email),
    email,
    name: identity.name,
    picture: identity.picture,
    provider: identity.provider ?? "cloudflare-access",
    providerUserId: identity.providerUserId,
    userUuid: identity.userUuid,
    permissions: admins.has(email)
      ? ADMIN_OPERATOR_PERMISSIONS
      : DEFAULT_OPERATOR_PERMISSIONS,
  };
}
