/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveServiceBaseUrl } from "../../../lib/service-map";
import { resolveEmployeeIdsByKey } from "../../lib/employee-resolution";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

function getTargetUrl(): string {
  return (
    process.env.CONTROL_PLANE_BASE_URL
    ?? process.env.OPERATOR_AGENT_BASE_URL
    ?? "https://example.com"
  );
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
    if (handleOperatorAgentSoftSkip("task-run-cognitive-contract-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  const task = await client.createTask({
    companyId: "company_internal_aep",
    originatingTeamId: "team_infra",
    assignedTeamId: "team_validation",
    assignedEmployeeId: reliabilityEngineerEmployeeId,
    createdByEmployeeId: infraOpsManagerEmployeeId,
    taskType: "validate-deployment",
    title: "Cognitive run contract task",
    payload: {
      targetUrl: getTargetUrl(),
      subjectRef: "deployment_validation_subject",
      source: "task-run-cognitive-contract-check",
    },
  });

  if (!task?.ok || !task?.taskId) {
    throw new Error(`Failed to create task: ${JSON.stringify(task)}`);
  }

  const result = await client.runEmployee<any>({
    companyId: "company_internal_aep",
    teamId: "team_validation",
    employeeId: reliabilityEngineerEmployeeId,
    roleId: "reliability-engineer",
    trigger: "manual",
    policyVersion: "ci-task-run-cognitive-contract-check",
    taskId: task.taskId,
  });

  if (!result?.ok || result?.status !== "completed") {
    throw new Error(`Expected completed run response, got ${JSON.stringify(result)}`);
  }

  if (!Array.isArray(result.decisions) || result.decisions.length === 0) {
    throw new Error(`Expected run decisions, got ${JSON.stringify(result.decisions)}`);
  }

  const decision = result.decisions[0];

  if (decision.taskId !== task.taskId) {
    throw new Error(`Expected decision.taskId=${task.taskId}, got ${decision.taskId}`);
  }

  if (Object.prototype.hasOwnProperty.call(decision, "internalMonologue")) {
    throw new Error("Validation decision should not expose internalMonologue publicly");
  }

  const taskDetail = await client.getTask(task.taskId);

  if (!taskDetail?.ok) {
    throw new Error(`Failed to fetch task detail: ${JSON.stringify(taskDetail)}`);
  }

  if (!Array.isArray(taskDetail.artifacts) || taskDetail.artifacts.length < 2) {
    throw new Error(`Expected plan and result artifacts, got ${JSON.stringify(taskDetail.artifacts)}`);
  }

  const artifactTypes = new Set(
    taskDetail.artifacts.map((artifact: any) => artifact.artifactType),
  );

  if (!artifactTypes.has("plan") || !artifactTypes.has("result")) {
    throw new Error(`Expected plan and result artifacts, got ${JSON.stringify(taskDetail.artifacts)}`);
  }

  console.log("task-run-cognitive-contract-check passed", {
    taskId: task.taskId,
    decisionVerdict: decision.verdict,
    artifactCount: taskDetail.artifacts.length,
  });
}

main().catch((error) => {
  console.error("task-run-cognitive-contract-check failed");
  console.error(error);
  process.exit(1);
});
