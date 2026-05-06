/**
 * Regression tests for PR-HIRE-5: hiring lane visibility on the product
 * initiative page.
 *
 * Covers:
 * - blocker with no linked staffing request shows no staffingRequestId
 * - submitted staffing request surfaces via staffingRequestId + state
 * - approved staffing request surfaces updated state
 * - fulfilled staffing request sets fulfillmentReady + fulfilledEmployeeId
 * - duplicate staffing requests: latest (by updatedAt) wins
 * - staffing request for an unrelated task is not linked
 */

import assert from "node:assert/strict";
import test from "node:test";
import { buildProductVisibilitySummary } from "./product-visibility-summary";
import type { StaffingRequestContract } from "../hr/staffing-contracts";
import type { Project, Task, TaskStore } from "../lib/store-types";

const PROJECT_ID = "project_hire_lane_test";
const COMPANY_ID = "company_hire_lane_test";
const TASK_ID = "task_hire_lane_001";

const baseProject: Project = {
  id: PROJECT_ID,
  companyId: COMPANY_ID,
  title: "Hire Lane Test Initiative",
  ownerTeamId: "team_web_product",
  status: "active",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const blockedTask: Task = {
  id: TASK_ID,
  companyId: COMPANY_ID,
  originatingTeamId: "team_web_product",
  assignedTeamId: "team_web_product",
  taskType: "requirements_definition",
  title: "Define product requirements",
  status: "blocked",
  errorMessage: "no active runtime employees for role product-manager-web",
  payload: { projectId: PROJECT_ID },
  blockingDependencyCount: 0,
};

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

function makeStaffingRequest(
  patch: Partial<StaffingRequestContract> = {},
): StaffingRequestContract {
  return {
    kind: "staffing_request",
    staffingRequestId: "staffreq_hire_lane_1",
    companyId: COMPANY_ID,
    roleId: "product-manager-web",
    teamId: "team_web_product",
    reason: "Need PM for blocked task",
    urgency: "high",
    source: { kind: "project", id: PROJECT_ID },
    requestedByEmployeeId: "operator:manual-qa",
    state: "submitted",
    updatedAt: "2026-01-01T00:00:00Z",
    employeeSpec: {
      roleId: "product-manager-web",
      teamId: "team_web_product",
      runtimeStatus: "implemented",
      employmentStatus: "active",
      schedulerMode: "auto",
      implementationBindingRequired: "pm-agent",
      suggestedName: "Web Product Manager",
      sourceTaskId: TASK_ID,
    },
    ...patch,
  } as unknown as StaffingRequestContract;
}

// ---------------------------------------------------------------------------

test("hiring lane: blocker with no staffing request has no staffingRequestId", async () => {
  const summary = await buildProductVisibilitySummary({
    store: makeStore([blockedTask]),
    staffingRequests: [],
    projectId: PROJECT_ID,
  });

  assert.ok(summary);
  assert.strictEqual(summary.staffing.staffingBlockers.length, 1);
  const blocker = summary.staffing.staffingBlockers[0];
  assert.strictEqual(blocker.staffingRequestId, undefined);
  assert.strictEqual(blocker.fulfillmentReady, false);
});

test("hiring lane: submitted staffing request is linked and shows state", async () => {
  const request = makeStaffingRequest({ state: "submitted" });
  const summary = await buildProductVisibilitySummary({
    store: makeStore([blockedTask]),
    staffingRequests: [request],
    projectId: PROJECT_ID,
  });

  assert.ok(summary);
  const blocker = summary.staffing.staffingBlockers[0];
  assert.strictEqual(blocker.staffingRequestId, "staffreq_hire_lane_1");
  assert.strictEqual(blocker.staffingRequestState, "submitted");
  assert.strictEqual(blocker.fulfillmentReady, false);
});

test("hiring lane: approved staffing request surfaces updated state", async () => {
  const request = makeStaffingRequest({
    staffingRequestId: "staffreq_hire_lane_2",
    state: "approved",
    updatedAt: "2026-01-02T00:00:00Z",
  });
  const summary = await buildProductVisibilitySummary({
    store: makeStore([blockedTask]),
    staffingRequests: [request],
    projectId: PROJECT_ID,
  });

  assert.ok(summary);
  const blocker = summary.staffing.staffingBlockers[0];
  assert.strictEqual(blocker.staffingRequestId, "staffreq_hire_lane_2");
  assert.strictEqual(blocker.staffingRequestState, "approved");
  assert.strictEqual(blocker.fulfillmentReady, false);
});

test("hiring lane: fulfilled request sets fulfillmentReady and fulfilledEmployeeId", async () => {
  const request = makeStaffingRequest({
    staffingRequestId: "staffreq_hire_lane_3",
    state: "fulfilled",
    updatedAt: "2026-01-03T00:00:00Z",
    fulfillment: { employeeId: "employee_web_pm_001" },
  });
  const summary = await buildProductVisibilitySummary({
    store: makeStore([blockedTask]),
    staffingRequests: [request],
    projectId: PROJECT_ID,
  });

  assert.ok(summary);
  const blocker = summary.staffing.staffingBlockers[0];
  assert.strictEqual(blocker.fulfillmentReady, true);
  assert.strictEqual(blocker.fulfilledEmployeeId, "employee_web_pm_001");
  assert.strictEqual(blocker.staffingRequestId, "staffreq_hire_lane_3");
});

test("hiring lane: duplicate requests surface the latest by updatedAt", async () => {
  const older = makeStaffingRequest({
    staffingRequestId: "staffreq_older",
    state: "submitted",
    updatedAt: "2026-01-01T00:00:00Z",
  });
  const newer = makeStaffingRequest({
    staffingRequestId: "staffreq_newer",
    state: "approved",
    updatedAt: "2026-01-05T00:00:00Z",
  });
  const summary = await buildProductVisibilitySummary({
    store: makeStore([blockedTask]),
    staffingRequests: [older, newer],
    projectId: PROJECT_ID,
  });

  assert.ok(summary);
  const blocker = summary.staffing.staffingBlockers[0];
  assert.strictEqual(blocker.staffingRequestId, "staffreq_newer");
  assert.strictEqual(blocker.staffingRequestState, "approved");
});

test("hiring lane: staffing request for an unrelated task is not linked", async () => {
  const unrelated = makeStaffingRequest({
    staffingRequestId: "staffreq_unrelated",
    employeeSpec: {
      roleId: "product-manager-web",
      teamId: "team_web_product",
      runtimeStatus: "implemented",
      employmentStatus: "active",
      schedulerMode: "auto",
      implementationBindingRequired: "pm-agent",
      suggestedName: "Web Product Manager",
      sourceTaskId: "task_other_999",
    },
  });
  const summary = await buildProductVisibilitySummary({
    store: makeStore([blockedTask]),
    staffingRequests: [unrelated],
    projectId: PROJECT_ID,
  });

  assert.ok(summary);
  const blocker = summary.staffing.staffingBlockers[0];
  assert.strictEqual(blocker.staffingRequestId, undefined);
  assert.strictEqual(blocker.staffingRequestState, undefined);
});
