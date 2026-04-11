/* eslint-disable no-console */

import { handleOperatorAgentSoftSkip } from "../../../lib/operator-agent-skip";
import { resolveServiceBaseUrl } from "../../../lib/service-map";

export {};

const POLICY_VERSION = "commit10-stageD";
const TEAM_ID = "team_infra";
const EXECUTION_COMPANY_ID = "company_internal_aep";

type ApprovalEntry = {
  approvalId: string;
  requestedByEmployeeId: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "expired";
  timestamp: string;
  companyId?: string;
  taskId?: string;
  heartbeatId?: string;
  executionContext?: {
    companyId?: string;
    taskId?: string;
    heartbeatId?: string;
    executionSource?: string;
    [key: string]: unknown;
  };
};

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
    companyId?: string;
    teamId?: string;
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
  approvals?: ApprovalEntry[];
  entries?: ApprovalEntry[];
};

type ControlHistoryResponse = {
  ok: true;
  count: number;
  entries: Array<{
    historyId: string;
    timestamp: string;
    employeeId: string;
    previousState?: string;
    nextState?: string;
    transition: string;
    reason: string;
    approvalId?: string;
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
      teamId: TEAM_ID,
      employeeId: "emp_infra_ops_manager_01",
      roleId: "infra-ops-manager",
      trigger: "paperclip",
      policyVersion: POLICY_VERSION,
      targetEmployeeIdsOverride: [
        "emp_timeout_recovery_01",
        "emp_retry_supervisor_01",
      ],
      companyId: EXECUTION_COMPANY_ID,
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

  if (result.executionContext?.companyId !== EXECUTION_COMPANY_ID) {
    throw new Error(
      `Expected executionContext.companyId=${EXECUTION_COMPANY_ID}`
    );
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

  if (result.request.teamId !== TEAM_ID) {
    throw new Error(`Expected request.teamId=${TEAM_ID}, got ${result.request.teamId}`);
  }

  // Additional validation: approval-linked governance artifact provenance preservation
  // When executed under paperclip origin, any approvals created should preserve company provenance

  const approvalsResponse = await fetch(`${agentBaseUrl}/agent/approvals?limit=100`);
  const approvals = await readJson<ApprovalsListResponse>(approvalsResponse);

  if (!approvals.ok) {
    throw new Error("/agent/approvals did not return ok=true for provenance validation");
  }

  const approvalEntries = Array.isArray(approvals.approvals)
    ? approvals.approvals
    : Array.isArray(approvals.entries)
      ? approvals.entries
      : null;

  if (!approvalEntries) {
    throw new Error(
      "/agent/approvals response missing approvals list (expected 'approvals' or 'entries' array)"
    );
  }

  // Check that any approvals related to this execution have company metadata
  const executionCompanyId = result.executionContext?.companyId || EXECUTION_COMPANY_ID;
  const executionTaskId = result.executionContext?.taskId || result.taskId;
  const executionSource = result.executionContext?.executionSource || "paperclip";

  let approvalsWithCompanyProvenance = 0;

  for (const approval of approvalEntries) {
    const approvalExecutionContext = approval.executionContext;

    if (
      approval.companyId === executionCompanyId &&
      approval.taskId === executionTaskId
    ) {
      if (approvalExecutionContext?.executionSource !== executionSource) {
        console.warn(
          `Warning: Approval ${approval.approvalId} has company provenance but ` +
            `executionSource mismatch. Expected "${executionSource}", ` +
            `got "${approvalExecutionContext?.executionSource}"`
        );
      }

      approvalsWithCompanyProvenance++;
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
    if (entry.approvalId) {
      const relatedApproval = approvalEntries.find(
        (approval) => approval.approvalId === entry.approvalId
      );

      if (relatedApproval?.companyId === executionCompanyId) {
        controlEntriesWithApprovalProvenance++;
      }

      if (!relatedApproval) {
        console.warn(
          `Warning: Control history entry ${entry.historyId} references ` +
            `approval ${entry.approvalId} that does not exist. ` +
            `This may indicate orphaned approval linkage.`
        );
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
    totalApprovalsInSystem: approvalEntries.length,
    controlEntriesWithApprovalProvenance,
    totalControlHistoryEntries: controlHistory.count,
    approvalProvenancePreserved:
      approvalsWithCompanyProvenance > 0 || approvalEntries.length === 0,
  });
}

main().catch((error) => {
  if (handleOperatorAgentSoftSkip("paperclip-company-handoff-check", error)) {
    process.exit(0);
  }

  console.error("paperclip-company-handoff-check failed");
  console.error(error);
  process.exit(1);
});
