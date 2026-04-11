export type ApprovalState =
  | "pending_review"
  | "approved"
  | "rejected"
  | "expired"
  | "already_executed"
  | "pending";

export type ApprovalControlHistoryEntry = {
  id: string;
  timestamp: string;
  action: string;
};

export type ApprovalEntry = {
  id?: string;
  approvalId?: string;
  employeeId?: string;
  requestedByEmployeeId?: string;
  reason: string;
  state?: ApprovalState;
  status?: "pending" | "approved" | "rejected" | "expired";
  requestedAt?: string;
  timestamp?: string;
  expiresAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  consumedAt?: string;
  decidedAt?: string;
  executedAt?: string;
  executionId?: string;
  metadata?: Record<string, unknown>;
  controlHistory?: ApprovalControlHistoryEntry[];
};

export type ApprovalsListResponse = {
  ok: true;
  count: number;
  approvals?: ApprovalEntry[];
  entries?: ApprovalEntry[];
};

export type ApprovalDetailResponse = {
  ok: true;
  id?: string;
  approval?: {
    id?: string;
    approvalId?: string;
  };
};

export const VALID_APPROVAL_STATES: readonly ApprovalState[] = [
  "pending",
  "pending_review",
  "approved",
  "rejected",
  "expired",
  "already_executed",
];

export function getApprovalEntries(
  response: ApprovalsListResponse,
): ApprovalEntry[] {
  if (Array.isArray(response.approvals)) {
    return response.approvals;
  }

  if (Array.isArray(response.entries)) {
    return response.entries;
  }

  return [];
}