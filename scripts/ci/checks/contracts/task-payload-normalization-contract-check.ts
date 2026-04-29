/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

const CHECK_NAME = "task-payload-normalization-contract-check";

function extractFailureBody(error: unknown): Record<string, unknown> | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const marker = "Request failed:";
  const markerIndex = message.indexOf(marker);

  if (markerIndex === -1) {
    return undefined;
  }

  const firstBrace = message.indexOf("{", markerIndex + marker.length);
  if (firstBrace === -1) {
    return undefined;
  }

  const jsonText = message.slice(firstBrace).trim();
  try {
    return JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

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

  try {
    await client.createTask({
      companyId: "company_internal_aep",
      originatingTeamId: "team_web_product",
      assignedTeamId: "team_web_product",
      createdByEmployeeId: CHECK_NAME,
      taskType: "web_implementation",
      title: "Invalid task payload check",
      payload: {
        targetUrl: "https://example.invalid",
      },
    });

    throw new Error("Expected missing requirementsRef to fail");
  } catch (error) {
    const failure = extractFailureBody(error);
    if (!failure) {
      throw error;
    }

    if (failure.code !== "missing_required_payload_field") {
      throw new Error(
        `Expected missing_required_payload_field, got: ${JSON.stringify(failure)}`,
      );
    }

    const details = (failure.details ?? {}) as Record<string, unknown>;
    if (details.field !== "requirementsRef") {
      throw new Error(
        `Expected missing requirementsRef detail, got: ${JSON.stringify(failure)}`,
      );
    }
  }

  const validResponse = await client.createTask({
    companyId: "company_internal_aep",
    originatingTeamId: "team_web_product",
    assignedTeamId: "team_web_product",
    createdByEmployeeId: CHECK_NAME,
    taskType: "website-implementation",
    title: "Valid task payload check",
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
