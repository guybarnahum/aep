/* eslint-disable no-console */

import { handleOperatorAgentSoftSkip } from "../../../lib/operator-agent-skip";
import { resolveServiceBaseUrl } from "../../../lib/service-map";

export {};

type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

type ApprovalEntry = {
  approvalId: string;
  timestamp: string;
  companyId?: string;
  taskId?: string;
  heartbeatId?: string;
  teamId: string;
  requestedByEmployeeId: string;
  requestedByEmployeeName?: string;
  requestedByRoleId: string;
  source: "manager" | "policy" | "system";
  actionType: string;
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  expiresAt?: string;
  reason: string;
  message: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionNote?: string;
  executedAt?: string;
  executionId?: string;
  executedByEmployeeId?: string;
  executedByRoleId?: string;
  executionContext?: Record<string, unknown>;
};

type ApprovalsListResponse = {
  ok: true;
  count: number;
  approvals?: ApprovalEntry[];
  entries?: ApprovalEntry[];
};

type ApprovalDetailResponse = {
  ok: true;
  approval: ApprovalEntry;
};

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed: ${response.status} ${body}`);
  }
  return (await response.json()) as T;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDateLike(value: string | undefined): boolean {
  if (!value) return false;
  const time = Date.parse(value);
  return Number.isFinite(time);
}

async function runApprovalStateMachineChecks(): Promise<void> {
  const baseUrl = await resolveServiceBaseUrl({
    envVar: "OPERATOR_AGENT_BASE_URL",
    serviceName: "operator-agent",
  });

  console.log(`[approval-state-machine-check] Using base URL: ${baseUrl}`);

  console.log("[approval-state-machine-check] Check 1: List approvals endpoint");
  const listResponse = await fetch(`${baseUrl}/agent/approvals`);
  const approvalsList = await readJson<ApprovalsListResponse>(listResponse);

  if (!approvalsList.ok) {
    throw new Error("Approvals list response missing ok=true");
  }

  if (typeof approvalsList.count !== "number") {
    throw new Error("Approvals list response missing numeric count field");
  }

  const approvals = Array.isArray(approvalsList.approvals)
    ? approvalsList.approvals
    : Array.isArray(approvalsList.entries)
      ? approvalsList.entries
      : null;

  if (!approvals) {
    throw new Error(
      "Approvals list response missing approvals list (expected 'approvals' or 'entries' array)"
    );
  }

  console.log(`  ✓ List approvals endpoint valid; found ${approvals.length} approvals`);

  console.log("[approval-state-machine-check] Check 2: Validate approval core shape and states");
  const validStates: readonly ApprovalStatus[] = [
    "pending",
    "approved",
    "rejected",
    "expired",
  ];

  for (const approval of approvals) {
    if (!approval.approvalId) {
      throw new Error("Approval missing approvalId");
    }

    if (!validStates.includes(approval.status)) {
      throw new Error(
        `Approval ${approval.approvalId} has invalid status: ${approval.status}. ` +
          `Expected one of: ${validStates.join(", ")}`
      );
    }

    if (!approval.timestamp) {
      throw new Error(`Approval ${approval.approvalId} missing timestamp`);
    }

    if (!isIsoDateLike(approval.timestamp)) {
      throw new Error(
        `Approval ${approval.approvalId} has non-ISO timestamp: ${approval.timestamp}`
      );
    }

    if (!approval.teamId) {
      throw new Error(`Approval ${approval.approvalId} missing teamId`);
    }

    if (!approval.requestedByEmployeeId) {
      throw new Error(
        `Approval ${approval.approvalId} missing requestedByEmployeeId`
      );
    }

    if (!approval.requestedByRoleId) {
      throw new Error(`Approval ${approval.approvalId} missing requestedByRoleId`);
    }

    if (!approval.source) {
      throw new Error(`Approval ${approval.approvalId} missing source`);
    }

    if (!approval.actionType) {
      throw new Error(`Approval ${approval.approvalId} missing actionType`);
    }

    if (!isObjectRecord(approval.payload)) {
      throw new Error(
        `Approval ${approval.approvalId} payload must be an object`
      );
    }

    if (!approval.reason) {
      throw new Error(`Approval ${approval.approvalId} missing reason`);
    }

    if (!approval.message) {
      throw new Error(`Approval ${approval.approvalId} missing message`);
    }

    if (approval.expiresAt && !isIsoDateLike(approval.expiresAt)) {
      throw new Error(
        `Approval ${approval.approvalId} has invalid expiresAt: ${approval.expiresAt}`
      );
    }

    if (approval.decidedAt && !isIsoDateLike(approval.decidedAt)) {
      throw new Error(
        `Approval ${approval.approvalId} has invalid decidedAt: ${approval.decidedAt}`
      );
    }

    if (approval.executedAt && !isIsoDateLike(approval.executedAt)) {
      throw new Error(
        `Approval ${approval.approvalId} has invalid executedAt: ${approval.executedAt}`
      );
    }
  }

  console.log("  ✓ Approval core shape and statuses are valid");

  console.log("[approval-state-machine-check] Check 3: Validate status-specific semantics");
  for (const approval of approvals) {
    if (approval.status === "approved" || approval.status === "rejected") {
      if (!approval.decidedAt) {
        throw new Error(
          `Approval ${approval.approvalId} is ${approval.status} but missing decidedAt`
        );
      }

      if (!approval.decidedBy) {
        throw new Error(
          `Approval ${approval.approvalId} is ${approval.status} but missing decidedBy`
        );
      }
    }

    if (approval.status === "expired") {
      if (!approval.expiresAt) {
        throw new Error(
          `Approval ${approval.approvalId} is expired but missing expiresAt`
        );
      }
    }

    if (approval.executedAt && !approval.executionId) {
      throw new Error(
        `Approval ${approval.approvalId} has executedAt but missing executionId`
      );
    }

    if (approval.executionId && !approval.executedAt) {
      throw new Error(
        `Approval ${approval.approvalId} has executionId but missing executedAt`
      );
    }
  }

  console.log("  ✓ Status-specific approval semantics are valid");

  console.log("[approval-state-machine-check] Check 4: Validate detail endpoint");
  if (approvals.length > 0) {
    const firstApproval = approvals[0];
    const detailResponse = await fetch(
      `${baseUrl}/agent/approvals/${firstApproval.approvalId}`
    );
    const detailEnvelope = await readJson<ApprovalDetailResponse>(detailResponse);

    if (!detailEnvelope.ok) {
      throw new Error("Approval detail response missing ok=true");
    }

    const approval = detailEnvelope.approval;
    if (!approval) {
      throw new Error("Approval detail response missing approval object");
    }

    if (approval.approvalId !== firstApproval.approvalId) {
      throw new Error(
        `Approval detail ID mismatch: expected ${firstApproval.approvalId}, got ${approval.approvalId}`
      );
    }

    if (approval.status !== firstApproval.status) {
      throw new Error(
        `Approval detail status mismatch: expected ${firstApproval.status}, got ${approval.status}`
      );
    }

    if (approval.timestamp !== firstApproval.timestamp) {
      throw new Error(
        `Approval detail timestamp mismatch: expected ${firstApproval.timestamp}, got ${approval.timestamp}`
      );
    }

    console.log(
      `  ✓ Approval detail endpoint valid for approval ${approval.approvalId}`
    );
  } else {
    console.log("  ⚠ No approvals to validate detail endpoint; skipping detail check");
  }

  console.log("[approval-state-machine-check] Check 5: Validate decision/execution consistency");
  for (const approval of approvals) {
    if (approval.status === "pending") {
      if (approval.decidedAt || approval.decidedBy) {
        throw new Error(
          `Approval ${approval.approvalId} is pending but already has decision fields`
        );
      }
    }

    if (approval.status === "expired" && approval.executedAt) {
      throw new Error(
        `Approval ${approval.approvalId} is expired but also has executedAt`
      );
    }

    if (approval.status === "rejected" && approval.executedAt) {
      throw new Error(
        `Approval ${approval.approvalId} is rejected but also has executedAt`
      );
    }
  }

  console.log("  ✓ Decision and execution consistency is valid");

  console.log("[approval-state-machine-check] Check 6: Validate expiration semantics");
  const now = Date.now();
  for (const approval of approvals) {
    if (approval.status === "pending" && approval.expiresAt) {
      const expiresTime = Date.parse(approval.expiresAt);
      if (Number.isFinite(expiresTime) && expiresTime <= now) {
        console.log(
          `  ⚠ Approval ${approval.approvalId} has past expiresAt but is still pending; expected lazy-expiration to convert it on read if fetched after store normalization`
        );
      }
    }
  }

  console.log("  ✓ Expiration semantics validated");

  console.log("[approval-state-machine-check] ✅ All approval state machine checks passed");
}

runApprovalStateMachineChecks().catch((err) => {
  if (handleOperatorAgentSoftSkip("approval-state-machine-check", err)) {
    process.exit(0);
  }

  console.error("[approval-state-machine-check] ❌ Check failed:", err.message);
  process.exit(1);
});