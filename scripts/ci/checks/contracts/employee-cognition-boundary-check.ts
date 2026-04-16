/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
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

  // PR7.8B structured cognition fields must remain private/internal.
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

  // Defensive: these also must not surface via public task detail.
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

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

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

  // Create a fresh task so this check is deterministic and does not inspect
  // historical artifacts produced by older code in the target environment.
  const task = await client.createTask({
    companyId: "company_internal_aep",
    originatingTeamId: "team_infra",
    assignedTeamId: "team_validation",
    assignedEmployeeId: "emp_val_specialist_01",
    createdByEmployeeId: "emp_infra_ops_manager_01",
    taskType: "validate-deployment",
    title: "Employee cognition boundary fresh-task check",
    payload: {
      targetUrl: getTargetUrl(),
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
    employeeId: "emp_val_specialist_01",
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

  // The whole public task-detail payload must not leak structured cognition.
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

  if (Array.isArray(taskDetail.artifacts)) {
    taskDetail.artifacts.forEach((artifact: Record<string, unknown>, index: number) => {
      if (artifact.content && typeof artifact.content === "object") {
        assertFieldsAbsent(
          artifact.content,
          [...FORBIDDEN_PUBLIC_FIELDS, "privateReasoning", "private_reasoning"],
          `/agent/tasks/:id artifacts[${index}].content`,
        );
      }
    });
  }

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
            [...FORBIDDEN_PUBLIC_FIELDS, "privateReasoning", "private_reasoning"],
            `/agent/message-threads/${thread.id} messages[${messageIndex}].body`,
          );
        }

        if (message.payload && typeof message.payload === "object") {
          assertFieldsAbsent(
            message.payload,
            [...FORBIDDEN_PUBLIC_FIELDS, "privateReasoning", "private_reasoning"],
            `/agent/message-threads/${thread.id} messages[${messageIndex}].payload`,
          );
        }
      });
    }
  }

  console.log("employee-cognition-boundary-check passed", {
    taskId: task.taskId,
    employeeCount: employeesResponse.count,
  });
}

main().catch((error) => {
  console.error("employee-cognition-boundary-check failed", error);
  process.exit(1);
});