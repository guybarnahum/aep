/**
 * Regression tests for BUG-012: auto-triggered work loop failures must be
 * visible in the initiative UI after a page refresh, without requiring the
 * user to manually click "Run team loop".
 *
 * The fix persists the loop result message (e.g. "waiting_for_staffing") to
 * tasks.error_message via setTaskErrorMessage(). These tests verify that the
 * message propagates through buildProductVisibilitySummary so the dashboard
 * task graph node can render it.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { buildProductVisibilitySummary } from "./product-visibility-summary";
import type {
  Task,
  Project,
  TaskStore,
} from "../lib/store-types";

const PROJECT_ID = "project_bug012_regression";
const COMPANY_ID = "company_test";

const fakeProject: Project = {
  id: PROJECT_ID,
  companyId: COMPANY_ID,
  title: "BUG-012 Regression Initiative",
  ownerTeamId: "team_web_product",
  status: "active",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const taskWithError: Task = {
  id: "task_project_planning_001",
  companyId: COMPANY_ID,
  originatingTeamId: "team_web_product",
  assignedTeamId: "team_web_product",
  taskType: "project_planning",
  title: "Plan product initiative",
  status: "ready",
  payload: { projectId: PROJECT_ID },
  blockingDependencyCount: 0,
  errorMessage:
    "Task task_project_planning_001 is assigned to unavailable runtime employee pm002. " +
    "Current team runtime roster: none.",
};

function makeStore(tasks: Task[], project = fakeProject): TaskStore {
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

test("BUG-012: errorMessage propagates through buildProductVisibilitySummary for active tasks", async () => {
  const summary = await buildProductVisibilitySummary({
    store: makeStore([taskWithError]),
    projectId: PROJECT_ID,
  });

  assert.ok(summary, "summary must be returned for a valid project");
  assert.strictEqual(summary.tasks.active.length, 1, "task should be in active (status: ready)");
  assert.strictEqual(
    summary.tasks.active[0].errorMessage,
    taskWithError.errorMessage,
    "errorMessage must propagate through product visibility summary so the UI can render it",
  );
});

test("BUG-012: errorMessage is included in tasks.recent", async () => {
  const summary = await buildProductVisibilitySummary({
    store: makeStore([taskWithError]),
    projectId: PROJECT_ID,
  });

  assert.ok(summary);
  const taskInRecent = summary.tasks.recent.find((t) => t.id === taskWithError.id);
  assert.ok(taskInRecent, "task should appear in tasks.recent");
  assert.strictEqual(
    taskInRecent.errorMessage,
    taskWithError.errorMessage,
    "errorMessage must be present in recent tasks (rendered in task graph section)",
  );
});

test("BUG-012: tasks without errorMessage have undefined errorMessage in summary", async () => {
  const cleanTask: Task = { ...taskWithError, errorMessage: undefined };
  const summary = await buildProductVisibilitySummary({
    store: makeStore([cleanTask]),
    projectId: PROJECT_ID,
  });

  assert.ok(summary);
  assert.strictEqual(
    summary.tasks.active[0].errorMessage,
    undefined,
    "tasks without errors must not have a spurious errorMessage",
  );
});

test("BUG-012: buildProductVisibilitySummary returns null for unknown project", async () => {
  const summary = await buildProductVisibilitySummary({
    store: makeStore([taskWithError]),
    projectId: "nonexistent_project",
  });

  assert.strictEqual(summary, null);
});

test("BUG-012: tasks not belonging to project are excluded from summary", async () => {
  const otherProjectTask: Task = {
    ...taskWithError,
    id: "task_other_001",
    payload: { projectId: "project_other" },
    errorMessage: "Should not appear",
  };
  const summary = await buildProductVisibilitySummary({
    store: makeStore([taskWithError, otherProjectTask]),
    projectId: PROJECT_ID,
  });

  assert.ok(summary);
  assert.strictEqual(
    summary.tasks.active.length,
    1,
    "only tasks belonging to the project should be included",
  );
  assert.strictEqual(summary.tasks.active[0].id, taskWithError.id);
});

test("BUG-012 scope: errorMessage on project B task is not affected by project A task sharing the same team", async () => {
  // Simulates the real failure mode: two ready team_web_product tasks exist.
  // An unscoped loop would pick either one, persisting the error to the wrong task.
  // After the fix, errorMessage is written to the pinned task (project B), not project A.
  const projectATask: Task = {
    ...taskWithError,
    id: "task_project_A_001",
    payload: { projectId: "project_A" },
    errorMessage: undefined, // no error persisted here
  };
  const projectBTask: Task = {
    ...taskWithError,
    id: "task_project_B_001",
    payload: { projectId: "project_B" },
    errorMessage: "Task task_project_B_001 is assigned to unavailable runtime employee pm002. Current team runtime roster: none.",
  };

  const summaryA = await buildProductVisibilitySummary({
    store: makeStore([projectATask, projectBTask], { ...fakeProject, id: "project_A" }),
    projectId: "project_A",
  });
  const summaryB = await buildProductVisibilitySummary({
    store: makeStore([projectATask, projectBTask], { ...fakeProject, id: "project_B" }),
    projectId: "project_B",
  });

  assert.ok(summaryA);
  assert.ok(summaryB);

  assert.strictEqual(
    summaryA.tasks.active[0].errorMessage,
    undefined,
    "project A task must not have error from project B loop run",
  );
  assert.strictEqual(
    summaryB.tasks.active[0].errorMessage,
    projectBTask.errorMessage,
    "project B task must carry the error that was persisted to it",
  );
});
