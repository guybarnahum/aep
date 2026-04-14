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
  "internalMonologue",
  "base_prompt",
  "decision_style",
  "collaboration_style",
  "identity_seed",
  "portrait_prompt",
  "prompt_version",
  "internal_monologue",
];

function getTargetUrl(): string {
  return (
    process.env.CONTROL_PLANE_BASE_URL
    ?? process.env.OPERATOR_AGENT_BASE_URL
    ?? "https://example.com"
  );
}

function assertNoPrivateFields(payload: unknown, surface: string): void {
  const serialized = JSON.stringify(payload);

  for (const field of FORBIDDEN_PUBLIC_FIELDS) {
    if (serialized.includes(field)) {
      throw new Error(`${surface} leaked private cognition field ${field}`);
    }
  }
}

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  let employeesResponse;
  try {
    employeesResponse = await client.listEmployees();
  } catch (err) {
    if (handleOperatorAgentSoftSkip("employee-cognition-boundary-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  if (!employeesResponse.ok) {
    throw new Error("/agent/employees did not return ok=true");
  }

  assertNoPrivateFields(employeesResponse, "/agent/employees");

  const task = await client.createTask({
    companyId: "company_internal_aep",
    originatingTeamId: "team_infra",
    assignedTeamId: "team_validation",
    assignedEmployeeId: "emp_val_specialist_01",
    createdByEmployeeId: "emp_infra_ops_manager_01",
    taskType: "validate-deployment",
    title: "PR7.8A cognition boundary task",
    payload: {
      targetUrl: getTargetUrl(),
      source: "employee-cognition-boundary-check",
    },
  });

  if (!task?.ok || !task?.taskId) {
    throw new Error(`Failed to create task: ${JSON.stringify(task)}`);
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

  assertNoPrivateFields(runResult, "/agent/run response");

  const taskDetail = await client.getTask(task.taskId);
  if (!taskDetail?.ok) {
    throw new Error(`Failed to fetch task detail: ${JSON.stringify(taskDetail)}`);
  }

  assertNoPrivateFields(taskDetail, "/agent/tasks/:id");

  console.log("employee-cognition-boundary-check passed", {
    taskId: task.taskId,
    employeeCount: employeesResponse.count,
  });
}

main().catch((error) => {
  console.error("employee-cognition-boundary-check failed");
  console.error(error);
  process.exit(1);
});