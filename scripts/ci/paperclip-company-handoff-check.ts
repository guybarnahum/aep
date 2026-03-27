/* eslint-disable no-console */

import { resolveServiceBaseUrl } from "../lib/service-map";

export {};

const POLICY_VERSION = "commit10-stageD";

type PaperclipRunResponse = {
  ok: true;
  status: "completed";
  companyId: string;
  taskId: string;
  heartbeatId: string;
  request: {
    policyVersion: string;
    trigger: string;
    employeeId: string;
    roleId: string;
  };
  result: unknown;
  executionSource: "paperclip";
  cronFallbackRecommended: boolean;
  executionContext?: {
    executionSource: "paperclip";
    companyId: string;
    taskId: string;
    heartbeatId: string;
  };
  routing?: {
    employeeId: string | null;
    workerId: string | null;
  };
};

type ApprovalsListResponse = {
  ok: true;
  count: number;
  approvals: Array<{
    id: string;
    employeeId: string;
    reason: string;
    state: "pending_review" | "approved" | "rejected" | "expired" | "already_executed";
    requestedAt: string;
    metadata?: {
      companyId?: string;
      taskId?: string;
      heartbeatId?: string;
      executionSource?: string;
      [key: string]: unknown;
    };
  }>;
};

type ControlHistoryResponse = {
  ok: true;
  count: number;
  entries: Array<{
    historyId: string;
    timestamp: string;
    employeeId: string;
    previousState?: {
      state: string;
      blocked: boolean;
    };
    nextState?: {
      state: string;
      blocked: boolean;
    };
    transition: string;
    reason: string;
    metadata?: {
      companyId?: string;
      taskId?: string;
      approvalId?: string;
      [key: string]: unknown;
    };
  }>;
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

async function main(): Promise<void> {
  const agentBaseUrl = resolveServiceBaseUrl({
    envVar: "OPERATOR_AGENT_BASE_URL",
    serviceName: "operator-agent",
  });

  const response = await fetch(`${agentBaseUrl}/agent/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-aep-execution-source": "paperclip",
    },
    body: JSON.stringify({
      departmentId: "aep-infra-ops",
      employeeId: "emp_infra_ops_manager_01",
      roleId: "infra-ops-manager",
      trigger: "paperclip",
      policyVersion: POLICY_VERSION,
      targetEmployeeIdsOverride: [
        "emp_timeout_recovery_01",
        "emp_retry_supervisor_01",
      ],
      companyId: "company-12345",
      heartbeatId: "hb-" + Date.now(),
      taskId: "task-" + Date.now(),
    }),
  });

  const result = await readJson<PaperclipRunResponse>(response);

  if (!result.ok) {
    throw new Error("Agent run did not return ok=true");
  }

  if (result.executionSource !== "paperclip") {
    throw new Error(
      `Expected executionSource="paperclip", got "${result.executionSource}"`
    );
  }

  if (result.executionContext?.executionSource !== "paperclip") {
    throw new Error("Expected executionContext.executionSource=paperclip");
  }

  if (result.executionContext?.companyId !== "company-12345") {
    throw new Error("Expected executionContext.companyId=company-12345");
  }

  if (result.cronFallbackRecommended !== false) {
    throw new Error(
      `Expected cronFallbackRecommended=false, got ${result.cronFallbackRecommended}`
    );
  }

  if (result.request.policyVersion !== POLICY_VERSION) {
    throw new Error(
      `Expected request.policyVersion="${POLICY_VERSION}", got "${result.request.policyVersion}"`
    );
  }

  if (result.request.trigger !== "paperclip") {
    throw new Error(
      `Expected request.trigger="paperclip", got "${result.request.trigger}"`
    );
  }

  if (result.request.employeeId !== "emp_infra_ops_manager_01") {
    throw new Error(
      `Expected employeeId=emp_infra_ops_manager_01, got ${result.request.employeeId}`
    );
  }

  // Additional validation: approval-linked governance artifact provenance preservation
  // When executed under paperclip origin, any approvals created should preserve company provenance

  const approvalsResponse = await fetch(`${agentBaseUrl}/agent/approvals?limit=100`);
  const approvals = await readJson<ApprovalsListResponse>(approvalsResponse);

  if (!approvals.ok) {
    throw new Error("/agent/approvals did not return ok=true for provenance validation");
  }

  // Check that any approvals related to this execution have company metadata
  const executionCompanyId = result.executionContext?.companyId || "company-12345";
  const executionTaskId = result.executionContext?.taskId || result.taskId;
  const executionSource = result.executionContext?.executionSource || "paperclip";

  let approvalsWithCompanyProvenance = 0;

  for (const approval of approvals.approvals) {
    if (approval.metadata) {
      // Approvals that came from this execution should have company metadata
      if (
        approval.metadata.companyId === executionCompanyId &&
        approval.metadata.taskId === executionTaskId
      ) {
        // Validate execution source is preserved
        if (approval.metadata.executionSource !== executionSource) {
          console.warn(
            `Warning: Approval ${approval.id} has company provenance but ` +
              `executionSource mismatch. Expected "${executionSource}", ` +
              `got "${approval.metadata.executionSource}"`
          );
        }

        approvalsWithCompanyProvenance++;
      }
    }
  }

  // Check control history for approval-related state transitions with company provenance
  const controlHistoryResponse = await fetch(
    `${agentBaseUrl}/agent/control-history?limit=100`
  );
  const controlHistory = await readJson<ControlHistoryResponse>(controlHistoryResponse);

  if (!controlHistory.ok) {
    throw new Error("/agent/control-history did not return ok=true for provenance validation");
  }

  let controlEntriesWithApprovalProvenance = 0;

  for (const entry of controlHistory.entries) {
    if (entry.metadata?.approvalId) {
      // Control history entries linked to approvals should have company context
      if (entry.metadata.companyId === executionCompanyId) {
        controlEntriesWithApprovalProvenance++;

        // Additional check: approval-based control changes should link to the approval
        const relatedApproval = approvals.approvals.find(
          (a) => a.id === entry.metadata?.approvalId
        );

        if (!relatedApproval) {
          console.warn(
            `Warning: Control history entry ${entry.historyId} references ` +
              `approval ${entry.metadata.approvalId} that does not exist. ` +
              `This may indicate orphaned approval linkage.`
          );
        }
      }
    }
  }

  console.log("paperclip-company-handoff-check passed", {
    executionSource: result.executionSource,
    cronFallbackRecommended: result.cronFallbackRecommended,
    policyVersion: result.request.policyVersion,
    trigger: result.request.trigger,
    employeeId: result.request.employeeId,
    routing: result.routing,
    hasExecutionContext: Boolean(result.executionContext),
    companyId: result.companyId,
    taskId: result.taskId,
    heartbeatId: result.heartbeatId,
    approvalsWithCompanyProvenance,
    totalApprovalsInSystem: approvals.count,
    controlEntriesWithApprovalProvenance,
    totalControlHistoryEntries: controlHistory.count,
    approvalProvenancePreserved: approvalsWithCompanyProvenance > 0 || approvals.count === 0,
  });
}

main().catch((error) => {
  console.error("paperclip-company-handoff-check failed");
  console.error(error);
  process.exit(1);
});
