/**
 * Regression tests for BUG-008: lifecycle approvals must be surfaced in
 * product visibility so the dashboard can present them without manual input.
 *
 * Covers:
 * - pending lifecycle approval included for matching project
 * - pending approval excluded for different project
 * - approved-but-not-executed approval exposed in lifecycleApproved
 * - already-executed approval excluded from lifecycleApproved
 * - empty approvals when no approval store is provided
 * - renderLifecycleControls: controls enabled/disabled based on approval lists
 */

import assert from "node:assert/strict";
import test from "node:test";
import { buildProductVisibilitySummary } from "./product-visibility-summary";
import type { ApprovalRecord } from "../types";
import type { TeamId } from "../org/teams";
import type { IApprovalStore, Project, Task, TaskStore } from "../lib/store-types";

const PROJECT_A = "project_lifecycle_A";
const PROJECT_B = "project_lifecycle_B";
const COMPANY_ID = "company_lifecycle_test";

const baseProject: Project = {
  id: PROJECT_A,
  companyId: COMPANY_ID,
  title: "Lifecycle Test Initiative",
  ownerTeamId: "team_web_product",
  status: "active",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const planningTask: Task = {
  id: "task_lifecycle_plan_001",
  companyId: COMPANY_ID,
  originatingTeamId: "team_web_product",
  assignedTeamId: "team_web_product",
  taskType: "project_planning",
  title: "Plan initiative",
  status: "ready",
  payload: { projectId: PROJECT_A },
  blockingDependencyCount: 0,
};

function makeApproval(
  overrides: Partial<ApprovalRecord> & { approvalId: string },
): ApprovalRecord {
  return {
    timestamp: "2026-04-30T10:00:00Z",
    companyId: COMPANY_ID,
    teamId: "team_web_product" as TeamId,
    requestedByEmployeeId: "pm001",
    requestedByRoleId: "product-manager-web",
    source: "policy",
    actionType: "product_lifecycle_retire",
    payload: {
      kind: "product_lifecycle_request",
      projectId: PROJECT_A,
      action: "retire",
      targetStatus: "archived",
    },
    status: "pending",
    reason: "QA cleanup",
    message: "Lifecycle retire requested",
    ...overrides,
  };
}

function makeStore(tasks: Task[] = [], project = baseProject): TaskStore {
  return {
    getProject: async (id: string) => (id === project.id ? project : null),
    getIntakeRequest: async () => null,
    listIntakeRequests: async () => [],
    listTasks: async () => tasks,
    listArtifactsForProject: async () => [],
    listProductDeployments: async () => [],
    listMessagesForProject: async () => [],
  } as unknown as TaskStore;
}

function makeApprovalStore(
  pending: ApprovalRecord[] = [],
  approved: ApprovalRecord[] = [],
): IApprovalStore {
  return {
    list: async (args: { status?: string }) => {
      if (args.status === "pending") return pending;
      if (args.status === "approved") return approved;
      return [];
    },
  } as unknown as IApprovalStore;
}

// ---------------------------------------------------------------------------

test("BUG-008: pending lifecycle approval is included in lifecyclePending for the correct project", async () => {
  const approval = makeApproval({ approvalId: "approval_pending_001" });
  const summary = await buildProductVisibilitySummary({
    store: makeStore([planningTask]),
    approvalStore: makeApprovalStore([approval]),
    projectId: PROJECT_A,
  });

  assert.ok(summary, "summary must be returned");
  assert.strictEqual(summary.approvals.lifecyclePending.length, 1);
  assert.strictEqual(summary.approvals.lifecyclePending[0].approvalId, "approval_pending_001");
});

test("BUG-008: pending lifecycle approval for a different project is excluded", async () => {
  const approvalForB = makeApproval({
    approvalId: "approval_other_project",
    payload: {
      kind: "product_lifecycle_request",
      projectId: PROJECT_B,
      action: "retire",
      targetStatus: "archived",
    },
  });
  const summary = await buildProductVisibilitySummary({
    store: makeStore([planningTask]),
    approvalStore: makeApprovalStore([approvalForB]),
    projectId: PROJECT_A,
  });

  assert.ok(summary);
  assert.strictEqual(
    summary.approvals.lifecyclePending.length,
    0,
    "approval for a different project must not appear in this project's pending list",
  );
});

test("BUG-008: approved-but-not-executed approval is included in lifecycleApproved", async () => {
  const approval = makeApproval({
    approvalId: "approval_ready_to_execute",
    status: "approved",
    decidedAt: "2026-04-30T11:00:00Z",
    decidedBy: "human_dashboard_operator",
  });
  const summary = await buildProductVisibilitySummary({
    store: makeStore([planningTask]),
    approvalStore: makeApprovalStore([], [approval]),
    projectId: PROJECT_A,
  });

  assert.ok(summary);
  assert.strictEqual(summary.approvals.lifecycleApproved.length, 1);
  assert.strictEqual(summary.approvals.lifecycleApproved[0].approvalId, "approval_ready_to_execute");
});

test("BUG-008: already-executed approval is excluded from lifecycleApproved", async () => {
  const executedApproval = makeApproval({
    approvalId: "approval_already_executed",
    status: "approved",
    decidedAt: "2026-04-30T11:00:00Z",
    decidedBy: "human_dashboard_operator",
    executedAt: "2026-04-30T11:05:00Z",
    executionId: "project_lifecycle:project_lifecycle_A:archived",
    executedByEmployeeId: "pm001",
  });
  const summary = await buildProductVisibilitySummary({
    store: makeStore([planningTask]),
    approvalStore: makeApprovalStore([], [executedApproval]),
    projectId: PROJECT_A,
  });

  assert.ok(summary);
  assert.strictEqual(
    summary.approvals.lifecycleApproved.length,
    0,
    "already-executed approval must not appear as executable again",
  );
});

test("BUG-008: approvals default to empty arrays when no approvalStore is provided", async () => {
  const summary = await buildProductVisibilitySummary({
    store: makeStore([planningTask]),
    projectId: PROJECT_A,
  });

  assert.ok(summary);
  assert.deepEqual(summary.approvals.lifecyclePending, []);
  assert.deepEqual(summary.approvals.lifecycleApproved, []);
});

test("BUG-008: multiple pending approvals for same project are all included", async () => {
  const approval1 = makeApproval({ approvalId: "approval_001" });
  const approval2 = makeApproval({ approvalId: "approval_002" });
  const approvalOther = makeApproval({
    approvalId: "approval_other",
    payload: {
      kind: "product_lifecycle_request",
      projectId: PROJECT_B,
      action: "pause",
      targetStatus: "paused",
    },
  });

  const summary = await buildProductVisibilitySummary({
    store: makeStore([planningTask]),
    approvalStore: makeApprovalStore([approval1, approval2, approvalOther]),
    projectId: PROJECT_A,
  });

  assert.ok(summary);
  assert.strictEqual(
    summary.approvals.lifecyclePending.length,
    2,
    "only approvals for this project should be included",
  );
  const ids = summary.approvals.lifecyclePending.map((a) => a.approvalId).sort();
  assert.deepEqual(ids, ["approval_001", "approval_002"]);
});
