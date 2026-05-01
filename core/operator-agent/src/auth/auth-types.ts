export type OperatorPermission =
  | "product.lifecycle.request"
  | "product.lifecycle.approve"
  | "product.lifecycle.execute"
  | "deployment.request"
  | "deployment.approve"
  | "deployment.execute"
  | "qa.cleanup"
  | "admin.runtime";

export interface CloudflareAccessIdentity {
  email: string;
  name?: string;
  picture?: string;
  provider?: string;
  providerUserId?: string;
  userUuid?: string;
  raw?: Record<string, unknown>;
}

export interface OperatorIdentity {
  operatorId: string;
  email: string;
  name?: string;
  picture?: string;
  provider?: string;
  providerUserId?: string;
  userUuid?: string;
  permissions: OperatorPermission[];
}

export interface AuthMeResponse {
  ok: true;
  operator: OperatorIdentity;
}

export interface AuthErrorResponse {
  ok: false;
  error: string;
}
