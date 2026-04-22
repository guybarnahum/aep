/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveServiceBaseUrl } from "../../../lib/service-map";
import { resolveEmployeeIdsByKey } from "../../lib/employee-resolution";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

const CHECK_NAME = "validation-result-artifact-check";
const CHECK_LABEL = "validation result artifact check";

const FORBIDDEN_PUBLIC_FIELDS = [
  "basePrompt",
  "decisionStyle",
  "collaborationStyle",
  "identitySeed",
  "portraitPrompt",
  "promptVersion",
  "base_prompt",
  "decision_style",
  "collaboration_style",
  "identity_seed",
  "portrait_prompt",
  "prompt_version",
  "privateReasoning",
  "private_reasoning",
  "internalMonologue",
  "internal_monologue",
  "intent",
  "riskLevel",
  "suggestedNextAction",
  "risk_level",
  "suggested_next_action",
];

function assertFieldsAbsent(payload: unknown, fields: string[], surface: string): void {
  const serialized = JSON.stringify(payload);

  for (const field of fields) {
    if (serialized.includes(field)) {
      throw new Error(`${surface} leaked private cognition field ${field}`);
    }
  }
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function getTargetUrl(): string {
  return (
    process.env.CONTROL_PLANE_BASE_URL
    ?? process.env.OPERATOR_AGENT_BASE_URL
    ?? "https://example.com"
  );
}

function findValidationResultArtifact(taskDetail: Record<string, unknown>): Record<string, unknown> | undefined {
  const artifacts = Array.isArray(taskDetail.artifacts)
    ? (taskDetail.artifacts as Record<string, unknown>[])
    : [];

  return artifacts.find((artifact) => {
    const content =
      artifact.content && typeof artifact.content === "object"
        ? (artifact.content as Record<string, unknown>)
        : undefined;

    return artifact.artifactType === "result" && content?.kind === "validation_result";
  });
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
      {
        key: "reliabilityEngineer",
        roleId: "reliability-engineer",
        teamId: "team_validation",
        runtimeStatus: "implemented",
      },
    ],
  });
  const infraOpsManagerEmployeeId = liveEmployeeIds.infraOpsManager;
  const reliabilityEngineerEmployeeId = liveEmployeeIds.reliabilityEngineer;

  try {
    await client.endpointExists("/agent/tasks");
  } catch (error) {
    if (handleOperatorAgentSoftSkip(CHECK_NAME, error)) {
      process.exit(0);
    }
    throw error;
  }

  const task = await client.createTask({
    companyId: "company_internal_aep",
    originatingTeamId: "team_infra",
    assignedTeamId: "team_validation",
    assignedEmployeeId: reliabilityEngineerEmployeeId,
    createdByEmployeeId: infraOpsManagerEmployeeId,
    taskType: "validate-deployment",
    title: "Validation result artifact contract check",
    payload: {
      targetUrl: getTargetUrl(),
      source: CHECK_NAME,
      useControlPlaneBinding: false,
    },
  });

  if (!task?.ok || !task?.taskId) {
    throw new Error(`Failed to create validation task: ${JSON.stringify(task)}`);
  }

  const runResult = await client.runEmployee<any>({
    companyId: "company_internal_aep",
    teamId: "team_validation",
    employeeId: reliabilityEngineerEmployeeId,
    roleId: "reliability-engineer",
    trigger: "manual",
    policyVersion: "ci-validation-result-artifact-check",
    taskId: task.taskId,
  });

  if (!runResult?.ok || runResult?.status !== "completed") {
    throw new Error(`Expected completed run response, got ${JSON.stringify(runResult)}`);
  }

  const taskDetail = await client.getTask(task.taskId);
  if (!taskDetail?.ok) {
    throw new Error(`Failed to fetch task detail for ${task.taskId}: ${JSON.stringify(taskDetail)}`);
  }

  const artifact = findValidationResultArtifact(taskDetail as Record<string, unknown>);
  if (!artifact) {
    throw new Error(`Expected validation_result artifact on task ${task.taskId}`);
  }

  const content =
    artifact.content && typeof artifact.content === "object"
      ? (artifact.content as Record<string, unknown>)
      : undefined;

  assert(content?.kind === "validation_result", `Expected content.kind=validation_result, got ${JSON.stringify(content)}`);

  assert(
    content?.status === "pass" || content?.status === "fail" || content?.status === "warning",
    `Expected validation_result.status to be pass|fail|warning, got ${JSON.stringify(content)}`,
  );

  assert(typeof content?.summary === "string" && content.summary.length > 0, `Expected validation_result.summary, got ${JSON.stringify(content)}`);
  assert(Array.isArray(content?.findings), `Expected validation_result.findings array, got ${JSON.stringify(content)}`);

  assertFieldsAbsent(
    content,
    FORBIDDEN_PUBLIC_FIELDS,
    `/agent/tasks/${task.taskId} validation_result artifact`,
  );

  console.log(`- PASS: ${CHECK_LABEL}`);
  console.log(`${CHECK_NAME} passed`, {
    taskId: task.taskId,
    artifactId: artifact.id,
    validationStatus: content?.status,
  });
}

main().catch((error) => {
  console.error(`${CHECK_NAME} failed`);
  console.error(error);
  process.exit(1);
});