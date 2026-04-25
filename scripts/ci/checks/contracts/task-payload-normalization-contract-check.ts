/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

const CHECK_NAME = "task-payload-normalization-contract-check";

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  try {
    await client.endpointExists("/agent/tasks");
  } catch (error) {
    if (handleOperatorAgentSoftSkip(CHECK_NAME, error)) {
      process.exit(0);
    }
    throw error;
  }

  const missingPayloadResponse = await client.createTask({
    companyId: "company_internal_aep",
    originatingTeamId: "team_web_product",
    assignedTeamId: "team_web_product",
    createdByEmployeeId: CHECK_NAME,
    taskType: "web_implementation",
    title: "Invalid PR16B payload check",
    payload: {
      targetUrl: "https://example.invalid",
    },
  });

  if (missingPayloadResponse?.ok) {
    throw new Error(
      `Expected missing requirementsRef to fail: ${JSON.stringify(missingPayloadResponse)}`,
    );
  }

  if (missingPayloadResponse?.code !== "missing_required_payload_field") {
    throw new Error(
      `Expected missing_required_payload_field, got: ${JSON.stringify(missingPayloadResponse)}`,
    );
  }

  const validResponse = await client.createTask({
    companyId: "company_internal_aep",
    originatingTeamId: "team_web_product",
    assignedTeamId: "team_web_product",
    createdByEmployeeId: CHECK_NAME,
    taskType: "website-implementation",
    title: "Valid PR16B payload check",
    payload: {
      targetUrl: "https://example.invalid",
      requirementsRef: "task_requirements_fixture",
    },
  });

  if (!validResponse?.ok || typeof validResponse.taskId !== "string") {
    throw new Error(
      `Expected valid aliased web implementation payload to create task: ${JSON.stringify(validResponse)}`,
    );
  }

  const detail = await client.getTask(validResponse.taskId);
  if (!detail?.ok || detail.task?.taskType !== "web_implementation") {
    throw new Error(
      `Expected legacy alias to persist as web_implementation: ${JSON.stringify(detail)}`,
    );
  }

  console.log("task-payload-normalization-contract-check passed", {
    taskId: validResponse.taskId,
  });
}

void main().catch((error) => {
  console.error("task-payload-normalization-contract-check failed");
  console.error(error);
  process.exit(1);
});
