/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveServiceBaseUrl } from "../../../lib/service-map";
import { resolveEmployeeIdsByKey } from "../../lib/employee-resolution";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

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

  "intent",
  "riskLevel",
  "suggestedNextAction",
  "risk_level",
  "suggested_next_action",
];

const FORBIDDEN_PRIVATE_DECISION_FIELDS = [
  "internalMonologue",
  "internal_monologue",
  "privateReasoning",
  "private_reasoning",
  "intent",
  "riskLevel",
  "suggestedNextAction",
  "risk_level",
  "suggested_next_action",
];

const FORBIDDEN_PUBLIC_ARTIFACT_FIELDS = [
  ...FORBIDDEN_PUBLIC_FIELDS,
  "privateReasoning",
  "private_reasoning",
  "internalMonologue",
  "internal_monologue",
];

function assertFieldsAbsent(payload: unknown, fields: string[], surface: string): void {
  const serialized = JSON.stringify(payload);

  for (const field of fields) {
    if (serialized.includes(field)) {
      throw new Error(`${surface} leaked private cognition field ${field}`);
    }
  }
}

function assertEmployeeProjectionPrivacy(employee: Record<string, unknown>, index: number): void {
  const surface = `/agent/employees employee[${index}]`;

  assertFieldsAbsent(employee, FORBIDDEN_PUBLIC_FIELDS, surface);

  if (employee.publicProfile && typeof employee.publicProfile === "object") {
    assertFieldsAbsent(
      employee.publicProfile,
      FORBIDDEN_PUBLIC_FIELDS,
      `${surface}.publicProfile`,
    );
  }

  if (employee.identity && typeof employee.identity === "object") {
    assertFieldsAbsent(
      employee.identity,
      FORBIDDEN_PUBLIC_FIELDS,
      `${surface}.identity`,
    );
  }

  if (employee.runtime && typeof employee.runtime === "object") {
    assertFieldsAbsent(
      employee.runtime,
      FORBIDDEN_PUBLIC_FIELDS,
      `${surface}.runtime`,
    );
  }
}

function getTargetUrl(): string {
  return (
    process.env.CONTROL_PLANE_BASE_URL
    ?? process.env.OPERATOR_AGENT_BASE_URL
    ?? "https://example.com"
  );
}

function findPublicRationaleArtifacts(taskDetail: Record<string, unknown>): Record<string, unknown>[] {
  const artifacts = Array.isArray(taskDetail.artifacts)
    ? (taskDetail.artifacts as Record<string, unknown>[])
    : [];

  return artifacts.filter((artifact) => {
    const content =
      artifact.content && typeof artifact.content === "object"
        ? (artifact.content as Record<string, unknown>)
        : undefined;

    return content?.kind === "public_rationale";
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
  } catch (err) {
    if (handleOperatorAgentSoftSkip("employee-cognition-boundary-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  const employeesResponse = await client.listEmployees();
  if (!employeesResponse?.ok) {
    throw new Error(`/agent/employees did not return ok=true`);
  }

  if (!Array.isArray(employeesResponse.employees)) {
    throw new Error("/agent/employees returned no employees array");
  }

  employeesResponse.employees.forEach((employee: Record<string, unknown>, index: number) => {
    assertEmployeeProjectionPrivacy(employee, index);
  });

  const task = await client.createTask({
    companyId: "company_internal_aep",
    originatingTeamId: "team_infra",
    assignedTeamId: "team_validation",
    assignedEmployeeId: reliabilityEngineerEmployeeId,
    createdByEmployeeId: infraOpsManagerEmployeeId,
    taskType: "validate-deployment",
    title: "Employee cognition boundary fresh-task check",
    payload: {
      targetUrl: getTargetUrl(),
      subjectRef: "deployment_validation_subject",
      source: "employee-cognition-boundary-check",
      useControlPlaneBinding: false,
    },
  });

  if (!task?.ok || !task?.taskId) {
    throw new Error(`Failed to create fresh validation task: ${JSON.stringify(task)}`);
  }

  const runResult = await client.runEmployee<any>({
    companyId: "company_internal_aep",
    teamId: "team_validation",
    employeeId: reliabilityEngineerEmployeeId,
    roleId: "reliability-engineer",
    trigger: "manual",
    policyVersion: "ci-employee-cognition-boundary-check",
    taskId: task.taskId,
  });

  if (!runResult?.ok || runResult?.status !== "completed") {
    throw new Error(`Expected completed run response, got ${JSON.stringify(runResult)}`);
  }

  const taskDetail = await client.getTask(task.taskId);
  if (!taskDetail?.ok) {
    throw new Error(`Failed to fetch task detail for ${task.taskId}: ${JSON.stringify(taskDetail)}`);
  }

  assertFieldsAbsent(
    taskDetail,
    FORBIDDEN_PUBLIC_FIELDS,
    "/agent/tasks/:id",
  );

  if (taskDetail.decision) {
    assertFieldsAbsent(
      taskDetail.decision,
      FORBIDDEN_PRIVATE_DECISION_FIELDS,
      "/agent/tasks/:id decision",
    );
  }

  const rationaleArtifacts = findPublicRationaleArtifacts(taskDetail as Record<string, unknown>);
  if (rationaleArtifacts.length === 0) {
    throw new Error(`Expected at least one public rationale artifact on task ${task.taskId}`);
  }

  rationaleArtifacts.forEach((artifact, index) => {
    const content =
      artifact.content && typeof artifact.content === "object"
        ? (artifact.content as Record<string, unknown>)
        : undefined;

    if (content) {
      assertFieldsAbsent(
        content,
        FORBIDDEN_PUBLIC_ARTIFACT_FIELDS,
        `/agent/tasks/:id public_rationale_artifacts[${index}].content`,
      );
    }
  });

  const relatedThreads = await client.listMessageThreads({
    relatedTaskId: task.taskId,
    limit: 20,
  });

  if (relatedThreads?.ok && Array.isArray(relatedThreads.threads)) {
    for (const thread of relatedThreads.threads) {
      if (!thread?.id) continue;

      const threadDetail = await client.getMessageThread(thread.id);
      if (!threadDetail?.ok || !Array.isArray(threadDetail.messages)) {
        continue;
      }

      threadDetail.messages.forEach((message: Record<string, unknown>, messageIndex: number) => {
        if (typeof message.body === "string") {
          assertFieldsAbsent(
            message.body,
            FORBIDDEN_PUBLIC_ARTIFACT_FIELDS,
            `/agent/message-threads/${thread.id} messages[${messageIndex}].body`,
          );
        }

        if (message.payload && typeof message.payload === "object") {
          assertFieldsAbsent(
            message.payload,
            FORBIDDEN_PUBLIC_ARTIFACT_FIELDS,
            `/agent/message-threads/${thread.id} messages[${messageIndex}].payload`,
          );
        }
      });
    }
  }

  console.log("employee-cognition-boundary-check passed", {
    taskId: task.taskId,
    employeeCount: employeesResponse.count,
    rationaleArtifactCount: rationaleArtifacts.length,
  });
}

main().catch((error) => {
  console.error("employee-cognition-boundary-check failed", error);
  process.exit(1);
});