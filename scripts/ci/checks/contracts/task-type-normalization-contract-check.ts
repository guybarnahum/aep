/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveServiceBaseUrl } from "../../../lib/service-map";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

const CHECK_NAME = "task-type-normalization-contract-check";
const LEGACY_ALIAS = "website-design";
const EXPECTED_CANONICAL_TYPE = "web_design";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const client = createOperatorAgentClient();
  const agentBaseUrl = resolveServiceBaseUrl({
    envVar: "OPERATOR_AGENT_BASE_URL",
    serviceName: "operator-agent",
  });

  try {
    await client.endpointExists("/agent/tasks");
  } catch (error) {
    if (handleOperatorAgentSoftSkip(CHECK_NAME, error)) {
      process.exit(0);
    }
    throw error;
  }

  const createResponse = await client.createTask({
    companyId: "company_internal_aep",
    originatingTeamId: "team_web_product",
    assignedTeamId: "team_web_product",
    createdByEmployeeId: "ci-task-type-normalization-check",
    taskType: LEGACY_ALIAS,
    title: `Task type normalization check ${Date.now()}`,
    payload: {
      source: CHECK_NAME,
      legacyAlias: LEGACY_ALIAS,
      expectedCanonicalType: EXPECTED_CANONICAL_TYPE,
      agentBaseUrl,
    },
  });

  if (!createResponse?.ok || typeof createResponse.taskId !== "string") {
    throw new Error(
      `Expected task creation with legacy alias to succeed: ${JSON.stringify(createResponse)}`,
    );
  }

  const taskId = createResponse.taskId;

  const detail = await client.getTask(taskId);
  assert(detail?.ok, `Expected task detail lookup to succeed: ${JSON.stringify(detail)}`);
  assert(detail.task?.id === taskId, "Expected task detail to return created task");
  assert(
    detail.task?.taskType === EXPECTED_CANONICAL_TYPE,
    `Expected task detail taskType=${EXPECTED_CANONICAL_TYPE}, got ${String(detail.task?.taskType)}`,
  );
  assert(
    detail.task?.taskType !== LEGACY_ALIAS,
    `Task detail leaked legacy alias taskType=${LEGACY_ALIAS}`,
  );

  const listed = await client.listTasks({
    companyId: "company_internal_aep",
    limit: 200,
  });
  assert(listed?.ok, `Expected tasks list lookup to succeed: ${JSON.stringify(listed)}`);
  assert(Array.isArray(listed.tasks), "Expected tasks list to return tasks[]");

  const listedTask = listed.tasks.find((task: any) => task.id === taskId);
  assert(listedTask, `Expected created task ${taskId} to appear in GET /agent/tasks`);
  assert(
    listedTask.taskType === EXPECTED_CANONICAL_TYPE,
    `Expected listed task taskType=${EXPECTED_CANONICAL_TYPE}, got ${String(listedTask.taskType)}`,
  );
  assert(
    listedTask.taskType !== LEGACY_ALIAS,
    `GET /agent/tasks leaked legacy alias taskType=${LEGACY_ALIAS}`,
  );

  console.log("task-type-normalization-contract-check passed", {
    taskId,
    legacyAlias: LEGACY_ALIAS,
    canonicalTaskType: EXPECTED_CANONICAL_TYPE,
  });
}

void main().catch((error) => {
  console.error("task-type-normalization-contract-check failed");
  console.error(error);
  process.exit(1);
});
