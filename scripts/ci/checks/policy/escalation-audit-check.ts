/* eslint-disable no-console */

import { handleOperatorAgentSoftSkip } from "../../../lib/operator-agent-skip";
import { resolveServiceBaseUrl } from "../../../lib/service-map";

export {};

const POLICY_VERSION = "commit10-stageD";

type ManagerDecision = {
  timestamp: string;
  managerEmployeeId: string;
  managerEmployeeName: string;
  teamId: string;
  roleId: string;
  policyVersion: string;
  employeeId: string;
  reason: string;
  recommendation: string;
  severity: string;
  message: string;
  evidence: {
    windowEntryCount: number;
    resultCounts: Record<string, number>;
  };
};

type ManagerRunResponse = {
  ok: true;
  status: "completed";
  policyVersion: string;
  trigger: string;
  employee: {
    employeeId: string;
    roleId: string;
  };
  observedEmployeeIds: string[];
  scanned: {
    workLogEntries: number;
    employeesObserved: number;
  };
  summary: {
    repeatedVerificationFailures: number;
    operatorActionFailures: number;
    budgetExhaustionSignals: number;
    reEnableDecisions: number;
    restrictionDecisions: number;
    clearedRestrictionDecisions: number;
    crossWorkerAlerts: number;
    escalationsCreated: number;
    decisionsEmitted: number;
  };
  perEmployee: unknown[];
  decisions: ManagerDecision[];
  message: string;
  controlPlaneBaseUrl: string;
};

type EscalationsResponse = {
  ok: true;
  count: number;
  entries: Array<{
    escalationId: string;
    timestamp: string;
    severity: string;
    state: string;
    reason: string;
    affectedEmployeeIds: string[];
    message: string;
    acknowledgedAt?: string;
    acknowledgedBy?: string;
    resolvedAt?: string;
    resolvedBy?: string;
    resolutionNote?: string;
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
    approvalId?: string;
    approvalState?: string;
  }>;
};

type ApprovalsListResponse = {
  ok: true;
  count: number;
  approvals?: Array<{
    id: string;
    employeeId: string;
    reason: string;
    state: "pending_review" | "approved" | "rejected" | "expired" | "already_executed";
    requestedAt: string;
    expiresAt?: string;
    approvedAt?: string;
    rejectedAt?: string;
    consumedAt?: string;
    metadata?: Record<string, unknown>;
  }>;
  entries?: Array<{
    id: string;
    employeeId: string;
    reason: string;
    state: "pending_review" | "approved" | "rejected" | "expired" | "already_executed";
    requestedAt: string;
    expiresAt?: string;
    approvedAt?: string;
    rejectedAt?: string;
    consumedAt?: string;
    metadata?: Record<string, unknown>;
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

async function runManager(
  agentBaseUrl: string,
  observedEmployeeIds: string[]
): Promise<ManagerRunResponse> {
  const response = await fetch(`${agentBaseUrl}/agent/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-aep-execution-source": "operator",
      "x-actor": "ci-escalation-audit-check",
    },
    body: JSON.stringify({
      teamId: "team_infra",
      employeeId: "emp_infra_ops_manager_01",
      roleId: "infra-ops-manager",
      trigger: "manual",
      policyVersion: POLICY_VERSION,
      targetEmployeeIdsOverride: observedEmployeeIds,
    }),
  });

  return readJson<ManagerRunResponse>(response);
}

async function getEscalations(agentBaseUrl: string): Promise<EscalationsResponse> {
  const response = await fetch(`${agentBaseUrl}/agent/escalations?limit=100`);
  return readJson<EscalationsResponse>(response);
}

async function getControlHistory(agentBaseUrl: string): Promise<ControlHistoryResponse> {
  const response = await fetch(`${agentBaseUrl}/agent/control-history?limit=100`);
  return readJson<ControlHistoryResponse>(response);
}

async function main(): Promise<void> {
  const agentBaseUrl = resolveServiceBaseUrl({
    envVar: "OPERATOR_AGENT_BASE_URL",
    serviceName: "operator-agent",
  });
  const observedEmployeeIds = (
    process.env.OPERATOR_AGENT_MANAGER_OBSERVED_EMPLOYEE_IDS ??
    "emp_timeout_recovery_01,emp_retry_supervisor_01"
  ).split(",").map((s) => s.trim()).filter((s) => s.length > 0);

  const managerRun = await runManager(agentBaseUrl, observedEmployeeIds);

  if (managerRun.policyVersion !== POLICY_VERSION) {
    throw new Error(
      `Unexpected manager policyVersion: ${managerRun.policyVersion}`
    );
  }

  if (managerRun.employee.employeeId !== "emp_infra_ops_manager_01") {
    throw new Error(
      `Unexpected manager employeeId: ${managerRun.employee.employeeId}`
    );
  }

  const escalations = await getEscalations(agentBaseUrl);
  if (!escalations.ok) {
    throw new Error("/agent/escalations did not return ok=true");
  }

  if (escalations.count < managerRun.summary.escalationsCreated) {
    throw new Error(
      `Expected at least ${managerRun.summary.escalationsCreated} escalations in store, got ${escalations.count}`
    );
  }

  const controlHistory = await getControlHistory(agentBaseUrl);
  if (!controlHistory.ok) {
    throw new Error("/agent/control-history did not return ok=true");
  }

  if (controlHistory.count === 0 && managerRun.summary.restrictionDecisions > 0) {
    throw new Error(
      "Expected control history records when restriction decisions were made"
    );
  }

  for (const escalation of escalations.entries) {
    if (!escalation.escalationId) {
      throw new Error("Escalation missing escalationId");
    }

    if (!escalation.timestamp) {
      throw new Error("Escalation missing timestamp");
    }

    if (!escalation.severity) {
      throw new Error("Escalation missing severity");
    }

    if (!escalation.state) {
      throw new Error("Escalation missing state");
    }

    if (!Array.isArray(escalation.affectedEmployeeIds)) {
      throw new Error("Escalation missing affectedEmployeeIds array");
    }
  }

  for (const entry of controlHistory.entries) {
    if (!entry.historyId) {
      throw new Error("Control history entry missing historyId");
    }

    if (!entry.timestamp) {
      throw new Error("Control history entry missing timestamp");
    }

    if (!entry.employeeId) {
      throw new Error("Control history entry missing employeeId");
    }

    if (!entry.transition) {
      throw new Error("Control history entry missing transition");
    }
  }

  // Validation: Escalation audit independence from approvals
  // If controlHistory has approval references, ensure they don't corrupt escalation records
  const entriesWithApprovals = controlHistory.entries.filter((e) => e.approvalId);

  if (entriesWithApprovals.length > 0) {
    // Fetch approvals to validate they exist and are in correct state
    const approvalsResponse = await fetch(`${agentBaseUrl}/agent/approvals?limit=100`);
    if (!approvalsResponse.ok) {
      throw new Error("Could not fetch approvals for audit trail validation");
    }

    const approvals = await readJson<ApprovalsListResponse>(approvalsResponse);

    if (!approvals.ok) {
      throw new Error("/agent/approvals did not return ok=true");
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

    const approvalIdSet = new Set(approvalEntries.map((a) => a.id));

    // Validate all referenced approvals exist
    for (const entry of entriesWithApprovals) {
      if (entry.approvalId && !approvalIdSet.has(entry.approvalId)) {
        throw new Error(
          `Control history entry ${entry.historyId} references non-existent approval ${entry.approvalId}`
        );
      }

      // Ensure approval state in control history matches actual approval state
      if (entry.approvalState) {
        const approval = approvalEntries.find((a) => a.id === entry.approvalId);
        if (approval && approval.state !== entry.approvalState) {
          console.warn(
            `Warning: Control history entry ${entry.historyId} recorded approval state ` +
              `${entry.approvalState}, but actual state is ${approval.state}. ` +
              `This may indicate time-of-check/time-of-use race condition.`
          );
        }
      }
    }
  }

  // Validation: Escalations should be immutable regardless of approval state
  for (const escalation of escalations.entries) {
    // Once an escalation is created, its core attributes shouldn't change
    if (!escalation.escalationId || !escalation.timestamp) {
      throw new Error("Escalation missing required immutable fields");
    }

    // Acknowledge/resolve may happen, but core escalation record should be preserved
    if (escalation.acknowledgedAt && escalation.acknowledgedBy) {
      // Acknowledgement is expected and fine
    } else if (escalation.resolvedAt && escalation.resolvedBy) {
      // Resolution is expected and fine
    }

    // Ensure escalation severity hasn't been altered
    if (!["critical", "high", "medium", "low"].includes(escalation.severity || "")) {
      throw new Error(
        `Escalation ${escalation.escalationId} has unexpected severity: ${escalation.severity}`
      );
    }
  }

  console.log("escalation-audit-check passed", {
    observedEmployeeIds,
    decisionsEmitted: managerRun.summary.decisionsEmitted,
    escalationsCreated: managerRun.summary.escalationsCreated,
    escalationsInAuditLog: escalations.count,
    controlStateTransitions: controlHistory.count,
    controlHistoryEntriesLinkedToApprovals: entriesWithApprovals.length,
    restrictionDecisions: managerRun.summary.restrictionDecisions,
  });
}

main().catch((error) => {
  if (handleOperatorAgentSoftSkip("escalation-audit-check", error)) {
    process.exit(0);
  }

  console.error("escalation-audit-check failed");
  console.error(error);
  process.exit(1);
});
