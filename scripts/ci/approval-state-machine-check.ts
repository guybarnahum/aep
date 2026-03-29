/* eslint-disable no-console */

import { handleOperatorAgentSoftSkip } from "../lib/operator-agent-skip";
import { resolveServiceBaseUrl } from "../lib/service-map";

export {};

type ApprovalEntry = {
  id: string;
  employeeId: string;
  reason: string;
  state: "pending_review" | "approved" | "rejected" | "expired" | "already_executed";
  requestedAt: string;
  expiresAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  expiredAt?: string;
  consumedAt?: string;
  metadata?: Record<string, unknown>;
  controlHistory?: Array<{
    id: string;
    timestamp: string;
    action: string;
  }>;
};

type ApprovalsListResponse = {
  ok: true;
  count: number;
  approvals?: ApprovalEntry[];
  entries?: ApprovalEntry[];
};

type ApprovalDetailResponse = {
  ok: true;
  id: string;
  employeeId: string;
  reason: string;
  state: "pending_review" | "approved" | "rejected" | "expired" | "already_executed";
  requestedAt: string;
  expiresAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  expiredAt?: string;
  consumedAt?: string;
  metadata?: Record<string, unknown>;
  controlHistory?: Array<{
    id: string;
    timestamp: string;
    action: string;
  }>;
};

type ApprovalActionResponse = {
  ok: true;
  id: string;
  state: "pending_review" | "approved" | "rejected" | "expired" | "already_executed";
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
    "pending_review",
    "approved",
    "rejected",
    "expired",
    "already_executed",
  ] as const;

  for (const approval of approvals) {
    if (!validStates.includes(approval.state as never)) {
      throw new Error(
        `Approval ${approval.id} has invalid state: ${approval.state}. ` +
          `Expected one of: ${validStates.join(", ")}`
      );
    }

    // Validate timestamp coherence
    if (!approval.requestedAt) {
      throw new Error(`Approval ${approval.id} missing requestedAt timestamp`);
    }

    // Validate state-specific fields
    if (approval.state === "approved" && !approval.approvedAt) {
      throw new Error(
        `Approval ${approval.id} is approved but missing approvedAt timestamp`
      );
    }

    if (approval.state === "rejected" && !approval.rejectedAt) {
      throw new Error(
        `Approval ${approval.id} is rejected but missing rejectedAt timestamp`
      );
    }

    if (approval.state === "expired" && !approval.expiredAt) {
      throw new Error(`Approval ${approval.id} is expired but missing expiredAt timestamp`);
    }

    if (approval.state === "already_executed" && !approval.consumedAt) {
      throw new Error(
        `Approval ${approval.id} is already_executed but missing consumedAt timestamp`
      );
    }
  }

  console.log(`  ✓ All approval states are valid`);

  // Check 3: Validate approval detail endpoint
  console.log("[approval-state-machine-check] Check 3: Validate approval detail endpoint");

  if (approvals.length > 0) {
    const firstApproval = approvals[0];
    const detailResponse = await fetch(`${baseUrl}/agent/approvals/${firstApproval.id}`);
    const approval = await readJson<ApprovalDetailResponse>(detailResponse);

    if (!approval.ok) {
      throw new Error("Approval detail response missing 'ok' field");
    }

    if (approval.id !== firstApproval.id) {
      throw new Error(
        `Approval detail ID mismatch: expected ${firstApproval.id}, got ${approval.id}`
      );
    }

    if (approval.state !== firstApproval.state) {
      throw new Error(
        `Approval detail state mismatch: expected ${firstApproval.state}, got ${approval.state}`
      );
    }

    console.log(`  ✓ Approval detail endpoint valid for approval ${approval.id}`);
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
            `Approval ${approval.id} control history entry missing id field`
          );
        }

        if (!entry.timestamp) {
          throw new Error(
            `Approval ${approval.id} control history entry missing timestamp field`
          );
        }

        if (!entry.action) {
          throw new Error(
            `Approval ${approval.id} control history entry missing action field`
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
          `Approval ${approval.id} metadata must be an object, got ${typeof approval.metadata}`
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
      approval.consumedAt ? new Date(approval.consumedAt).getTime() : null,
    ].filter((t) => t !== null);

    if (timestamps.length > 1) {
      throw new Error(
        `Approval ${approval.id} has multiple terminal timestamps: ` +
          `approved=${approval.approvedAt}, rejected=${approval.rejectedAt}, ` +
          `expired=${approval.expiredAt}, consumed=${approval.consumedAt}. ` +
          `An approval can only have one terminal state.`
      );
    }
  }

  console.log(`  ✓ No conflicting approval terminal states detected`);

  // Check 7: Validate expiration timeout semantics
  console.log("[approval-state-machine-check] Check 7: Validate expiration semantics");

  for (const approval of approvals) {
    if (approval.state === "pending_review" && approval.expiresAt) {
      const expiresTime = new Date(approval.expiresAt).getTime();
      const now = Date.now();

      if (expiresTime <= now) {
        console.log(
          `  ⚠ Approval ${approval.id} has expired expiresAt but is still pending_review; ` +
            `expected state to be 'expired'`
        );
      }
    }
  }

  console.log(`  ✓ Expiration semantics validated`);

  // Check 8: Validate reject preserves request context
  console.log(
    "[approval-state-machine-check] Check 8: Validate rejected approvals preserve context"
  );

  const rejectedApprovals = approvals.filter((a) => a.state === "rejected");

  for (const approval of rejectedApprovals) {
    if (!approval.rejectedAt) {
      throw new Error(
        `Rejected approval ${approval.id} missing rejectedAt timestamp`
      );
    }

    if (!approval.reason) {
      throw new Error(`Rejected approval ${approval.id} missing reason field`);
    }

    if (!approval.employeeId) {
      throw new Error(
        `Rejected approval ${approval.id} missing employeeId field`
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
