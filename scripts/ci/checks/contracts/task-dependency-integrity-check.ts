/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveServiceBaseUrl } from "../../../lib/service-map";
import { resolveEmployeeIdsByKey } from "../../lib/employee-resolution";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

async function expectTaskCreateFailure(
  fn: () => Promise<any>,
  expectedCode: string,
): Promise<any> {
  try {
    const response = await fn();

    if (response?.ok !== false || response?.code !== expectedCode) {
      throw new Error(
        `Expected task create failure code=${expectedCode}, got ${JSON.stringify(response)}`,
      );
    }

    return response;
  } catch (err: any) {
    const message = String(err?.message ?? err);

    if (!message.includes("400")) {
      throw err;
    }

    if (!message.includes(expectedCode)) {
      throw new Error(
        `Expected HTTP 400 containing code=${expectedCode}, got: ${message}`,
      );
    }

    return { ok: false, code: expectedCode };
  }
}

async function main(): Promise<void> {
  const client = createOperatorAgentClient();
  const agentBaseUrl = resolveServiceBaseUrl({
    envVar: "OPERATOR_AGENT_BASE_URL",
    serviceName: "operator-agent",
  });
  const liveEmployeeIds = await resolveEmployeeIdsByKey({
    agentBaseUrl,
    employees: [
      {
        key: "infraOpsManager",
        roleId: "infra-ops-manager",
        teamId: "team_infra",
        runtimeStatus: "implemented",
      },
    ],
  });
  const infraOpsManagerEmployeeId = liveEmployeeIds.infraOpsManager;

  try {
    await client.endpointExists("/agent/tasks");
  } catch (err) {
    if (handleOperatorAgentSoftSkip("task-dependency-integrity-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  const baseTask = await client.createTask({
    companyId: "company_internal_aep",
    originatingTeamId: "team_infra",
    assignedTeamId: "team_validation",
    createdByEmployeeId: infraOpsManagerEmployeeId,
    taskType: "stage1-dependency-base",
    title: "Stage 1 dependency base task",
    payload: {
      source: "task-dependency-integrity-check",
    },
  });

  if (!baseTask?.ok || !baseTask?.taskId) {
    throw new Error(`Failed to create base task: ${JSON.stringify(baseTask)}`);
  }

  const dependentTask = await client.createTask({
    companyId: "company_internal_aep",
    originatingTeamId: "team_infra",
    assignedTeamId: "team_validation",
    createdByEmployeeId: infraOpsManagerEmployeeId,
    taskType: "stage1-dependent",
    title: "Stage 1 dependent task",
    dependsOnTaskIds: [baseTask.taskId],
    payload: {
      source: "task-dependency-integrity-check",
    },
  });

  if (!dependentTask?.ok || !dependentTask?.taskId) {
    throw new Error(
      `Failed to create dependent task: ${JSON.stringify(dependentTask)}`,
    );
  }

  const dependentDetail = await client.getTask(dependentTask.taskId);

  if (!dependentDetail?.ok) {
    throw new Error(
      `Failed to fetch dependent task detail: ${JSON.stringify(dependentDetail)}`,
    );
  }

  if (dependentDetail.task?.status !== "blocked") {
    throw new Error(
      `Expected dependent task status=blocked, got ${dependentDetail.task?.status}`,
    );
  }

  if (dependentDetail.task?.blockingDependencyCount !== 1) {
    throw new Error(
      `Expected blockingDependencyCount=1, got ${dependentDetail.task?.blockingDependencyCount}`,
    );
  }

  if (!Array.isArray(dependentDetail.dependencies) || dependentDetail.dependencies.length !== 1) {
    throw new Error(
      `Expected exactly 1 dependency, got ${JSON.stringify(dependentDetail.dependencies)}`,
    );
  }

  await expectTaskCreateFailure(
    () =>
      client.createTask({
        companyId: "company_internal_aep",
        originatingTeamId: "team_infra",
        assignedTeamId: "team_validation",
        createdByEmployeeId: infraOpsManagerEmployeeId,
        taskType: "stage1-duplicate-dependency",
        title: "Stage 1 duplicate dependency task",
        dependsOnTaskIds: [baseTask.taskId, baseTask.taskId],
        payload: {
          source: "task-dependency-integrity-check",
        },
      }),
    "duplicate_dependency",
  );

  await expectTaskCreateFailure(
    () =>
      client.createTask({
        companyId: "company_internal_aep",
        originatingTeamId: "team_infra",
        assignedTeamId: "team_validation",
        createdByEmployeeId: infraOpsManagerEmployeeId,
        taskType: "stage1-missing-dependency",
        title: "Stage 1 missing dependency task",
        dependsOnTaskIds: ["task_missing_dependency_01"],
        payload: {
          source: "task-dependency-integrity-check",
        },
      }),
    "dependency_not_found",
  );

  console.log("task-dependency-integrity-check passed", {
    baseTaskId: baseTask.taskId,
    dependentTaskId: dependentTask.taskId,
    dependentStatus: dependentDetail.task.status,
    dependencyCount: dependentDetail.dependencies.length,
  });
}

main().catch((error) => {
  console.error("task-dependency-integrity-check failed");
  console.error(error);
  process.exit(1);
});