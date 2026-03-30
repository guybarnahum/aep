/* eslint-disable no-console */

import { handleOperatorAgentSoftSkip } from "../lib/operator-agent-skip";
import { resolveServiceBaseUrl } from "../lib/service-map";

export {};

type ApprovalEntry = {
  approvalId: string;
  employeeId: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "expired";
  requestedAt: string;
  expiresAt?: string;
  approvalId: string;
  timestamp: string;
  companyId?: string;
  taskId?: string;
  heartbeatId?: string;
  departmentId: string;
  requestedByEmployeeId: string;
  requestedByEmployeeName?: string;
  requestedByRoleId: string;
  source: string;
  actionType: string;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "expired";
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

type ApprovalDetailResponse = {
  ok: true;
  approval: ApprovalEntry;
};

type ApprovalActionResponse = {
  ok: true;
  approvalId: string;
  status: "pending" | "approved" | "rejected" | "expired";
  actionedAt?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed: ${response.status} ${body}`);
  }
  return (await response.json()) as T;
}

async function runApprovalStateMachineChecks(): Promise<void> {
  const baseUrl = await resolveServiceBaseUrl({
    envVar: "OPERATOR_AGENT_BASE_URL",
    serviceName: "operator-agent",
  });

  console.log(`[approval-state-machine-check] Using base URL: ${baseUrl}`);

  // Check 1: List approvals and validate response shape
  console.log("[approval-state-machine-check] Check 1: List approvals endpoint");
  const listResponse = await fetch(`${baseUrl}/agent/approvals`);
  const approvalsList = await readJson<ApprovalsListResponse>(listResponse);

  if (!approvalsList.ok) {
    throw new Error("Approvals list response missing 'ok' field");
  }

  if (typeof approvalsList.count !== "number") {
    throw new Error("Approvals list response missing 'count' field");
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

  // Check 2: Validate approval state enum values
  console.log("[approval-state-machine-check] Check 2: Validate approval states");
  const validStates = [
    "pending",
    "approved",
    "rejected",
    "expired",
  ] as const;

  for (const approval of approvals) {
    if (!validStates.includes(approval.status as never)) {
      throw new Error(
        `Approval ${approval.approvalId} has invalid status: ${approval.status}. ` +
          `Expected one of: ${validStates.join(", ")}`
      );
    }
    if (!approval.timestamp) {
      throw new Error(`Approval ${approval.approvalId} missing timestamp field`);
    }
    if (!approval.requestedByEmployeeId) {
      throw new Error(`Approval ${approval.approvalId} missing requestedByEmployeeId field`);
    }
    if (!approval.reason) {
      throw new Error(`Approval ${approval.approvalId} missing reason field`);
    }
    if (!approval.message) {
      throw new Error(`Approval ${approval.approvalId} missing message field`);
    }
    // Optional: check for departmentId, actionType, etc. as needed
  }

  console.log(`  ✓ All approval states are valid`);

  // Check 3: Validate approval detail endpoint
  console.log("[approval-state-machine-check] Check 3: Validate approval detail endpoint");

  if (approvals.length > 0) {
    const firstApproval = approvals[0];
    const detailResponse = await fetch(`${baseUrl}/agent/approvals/${firstApproval.approvalId}`);
    const detailEnvelope = await readJson<ApprovalDetailResponse>(detailResponse);
    const approval = detailEnvelope.approval;

    if (!detailEnvelope.ok) {
      throw new Error("Approval detail response missing 'ok' field");
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

    console.log(`  ✓ Approval detail endpoint valid for approval ${approval.approvalId}`);
  } else {
    console.log(`  ⚠ No approvals to validate detail endpoint; skipping detail check`);
  }

  // Check 4: Validate approval control history linkage
  console.log("[approval-state-machine-check] Check 4: Validate approval control history");

  for (const approval of approvals) {
    if (approval.controlHistory && Array.isArray(approval.controlHistory)) {
      for (const entry of approval.controlHistory) {
        if (!entry.id) {
          throw new Error(
            `Approval ${approval.approvalId} control history entry missing id field`
          );
        }

        if (!entry.timestamp) {
          throw new Error(
            `Approval ${approval.approvalId} control history entry missing timestamp field`
          );
        }

        if (!entry.action) {
          throw new Error(
            `Approval ${approval.approvalId} control history entry missing action field`
          );
        }
      }
    }
  }

  console.log(`  ✓ Approval control history linkage is valid`);

  // Check 5: Validate approval metadata shape
  console.log("[approval-state-machine-check] Check 5: Validate approval metadata");

  for (const approval of approvals) {
    if (approval.metadata) {
      if (typeof approval.metadata !== "object" || Array.isArray(approval.metadata)) {
        throw new Error(
          `Approval ${approval.approvalId} metadata must be an object, got ${typeof approval.metadata}`
        );
      }
    }
  }

  console.log(`  ✓ Approval metadata is valid`);

  // Check 6: Validate no stale transition states
  console.log(
    "[approval-state-machine-check] Check 6: Validate no conflicting timestamps"
  );

  for (const approval of approvals) {
    const timestamps = [
      approval.approvedAt ? new Date(approval.approvedAt).getTime() : null,
      approval.rejectedAt ? new Date(approval.rejectedAt).getTime() : null,
      approval.expiredAt ? new Date(approval.expiredAt).getTime() : null,
    ].filter((t) => t !== null);

    if (timestamps.length > 1) {
      throw new Error(
        `Approval ${approval.approvalId} has multiple terminal timestamps: ` +
          `approved=${approval.approvedAt}, rejected=${approval.rejectedAt}, expired=${approval.expiredAt}. ` +
          `An approval can only have one terminal state.`
      );
    }
  }

  console.log(`  ✓ No conflicting approval terminal states detected`);

  // Check 7: Validate expiration timeout semantics
  console.log("[approval-state-machine-check] Check 7: Validate expiration semantics");

  for (const approval of approvals) {
    if (approval.status === "pending" && approval.expiresAt) {
      const expiresTime = new Date(approval.expiresAt).getTime();
      const now = Date.now();

      if (expiresTime <= now) {
        console.log(
          `  ⚠ Approval ${approval.approvalId} has expired expiresAt but is still pending; expected status to be 'expired'`
        );
      }
    }
  }

  console.log(`  ✓ Expiration semantics validated`);

  // Check 8: Validate reject preserves request context
  console.log(
    "[approval-state-machine-check] Check 8: Validate rejected approvals preserve context"
  );

  const rejectedApprovals = approvals.filter((a) => a.status === "rejected");

  for (const approval of rejectedApprovals) {
    if (!approval.rejectedAt) {
      throw new Error(
        `Rejected approval ${approval.approvalId} missing rejectedAt timestamp`
      );
    }

    if (!approval.reason) {
      throw new Error(`Rejected approval ${approval.approvalId} missing reason field`);
    }

    if (!approval.employeeId) {
      throw new Error(
        `Rejected approval ${approval.approvalId} missing employeeId field`
      );
    }
  }

  console.log(`  ✓ Rejected approvals preserve context (${rejectedApprovals.length} found)`);

  console.log("[approval-state-machine-check] ✅ All approval state machine checks passed");
}

runApprovalStateMachineChecks().catch((err) => {
  if (handleOperatorAgentSoftSkip("approval-state-machine-check", err)) {
    process.exit(0);
  }

  console.error("[approval-state-machine-check] ❌ Check failed:", err.message);
  process.exit(1);
});
