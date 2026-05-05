/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveEmployeeIdByRole } from "../../lib/employee-resolution";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";
import { resolveServiceBaseUrl } from "../../../lib/service-map";

export {};

const PM_TEAM_ID = "team_web_product";
const PM_ROLE_ID = "product-manager-web";
const VALIDATION_TEAM_ID = "team_validation";
const VALIDATION_ROLE_ID = "reliability-engineer";

function getTaskEntries(response: any): any[] {
  if (Array.isArray(response?.tasks)) return response.tasks;
  if (Array.isArray(response?.entries)) return response.entries;
  return [];
}

function softSkip(reason: string): never {
  console.warn(`org-resolver-planning-defaults-check skipped: ${reason}`);
  console.log("org-resolver-planning-defaults-check skipped", { reason });
  process.exit(0);
}

async function main(): Promise<void> {
  const client = createOperatorAgentClient();
  const agentBaseUrl = resolveServiceBaseUrl({
    envVar: "OPERATOR_AGENT_BASE_URL",
    serviceName: "operator-agent",
  });

  try {
    await client.endpointExists("/agent/tasks");
  } catch (err) {
    if (handleOperatorAgentSoftSkip("org-resolver-planning-defaults-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  const productManagerEmployeeId = await resolveEmployeeIdByRole({
    agentBaseUrl,
    roleId: PM_ROLE_ID,
    teamId: PM_TEAM_ID,
    runtimeStatus: "implemented",
    required: {
      scope: {
        allowedServices: ["service_dashboard"],
        allowedEnvironmentNames: ["preview"],
      },
    },
  });
  const reliabilityEngineerEmployeeId = await resolveEmployeeIdByRole({
    agentBaseUrl,
    roleId: VALIDATION_ROLE_ID,
    teamId: VALIDATION_TEAM_ID,
  });

  const employees = await client.listEmployees();

  if (!employees?.ok || !Array.isArray(employees.employees)) {
    throw new Error(`Failed to list employees: ${JSON.stringify(employees)}`);
  }

  const productManagerProjection = employees.employees.find(
    (employee: any) =>
      employee?.identity?.employeeId === productManagerEmployeeId
      && employee?.identity?.teamId === PM_TEAM_ID
      && employee?.identity?.roleId === PM_ROLE_ID,
  );

  if (!productManagerProjection) {
    softSkip("runtime PM employee is not present in this deployment");
  }

  if (productManagerProjection.runtime?.runtimeStatus !== "implemented") {
    softSkip("web PM is planned-only in this deployment and cannot be executed through /agent/run");
  }

  const before = await client.listTasks({
    companyId: "company_internal_aep",
    limit: 100,
  });

  const beforeIds = new Set(getTaskEntries(before).map((task: any) => task.id));

  const result = await client.runEmployee({
    companyId: "company_internal_aep",
    teamId: PM_TEAM_ID,
    employeeId: productManagerEmployeeId,
    roleId: PM_ROLE_ID,
    trigger: "manual",
    policyVersion: "ci-planning-defaults",
  });

  if (!(result as any)?.ok) {
    throw new Error(`PM run failed: ${JSON.stringify(result)}`);
  }

  const after = await client.listTasks({
    companyId: "company_internal_aep",
    limit: 100,
  });

  const newTasks = getTaskEntries(after).filter(
    (task: any) => !beforeIds.has(task.id),
  );

  const planningRoot = newTasks.find(
    (task: any) => task.taskType === "task_graph_planning",
  );

  if (!planningRoot?.id) {
    throw new Error(`Failed to locate planning root task: ${JSON.stringify(newTasks)}`);
  }

  const planningRootDetail = await client.getTask(planningRoot.id);

  if (!(planningRootDetail as any)?.ok || !(planningRootDetail as any)?.task) {
    throw new Error(
      `Failed to fetch planning root detail: ${JSON.stringify(planningRootDetail)}`,
    );
  }

  const planArtifacts = Array.isArray((planningRootDetail as any)?.artifacts)
    ? (planningRootDetail as any).artifacts.filter(
        (artifact: any) =>
          artifact.artifactType === "plan"
          && artifact.content?.kind === "execution_plan",
      )
    : [];

  if (planArtifacts.length === 0) {
    throw new Error(
      `Expected execution plan artifact on planning root: ${JSON.stringify(planningRootDetail)}`,
    );
  }

  const planArtifact = planArtifacts[0];
  const steps = Array.isArray(planArtifact?.content?.steps)
    ? planArtifact.content.steps
    : [];

  if (steps.length !== 4) {
    throw new Error(`Expected 4 plan steps, got ${steps.length}: ${JSON.stringify(planArtifact)}`);
  }

  const expectedByCapability: Record<string, { teamId: string; employeeId?: string }> = {
    design: { teamId: "team_web_product" },
    implementation: { teamId: "team_web_product" },
    deployment: { teamId: "team_infra" },
    validation: {
      teamId: "team_validation",
      employeeId: reliabilityEngineerEmployeeId,
    },
  };

  for (const step of steps) {
    const expected = expectedByCapability[step.capability];
    if (!expected) {
      throw new Error(`Unexpected capability in plan artifact: ${JSON.stringify(step)}`);
    }

    if (step.assignedTeamId !== expected.teamId) {
      throw new Error(
        `Capability routing mismatch for ${step.capability}: ${JSON.stringify(step)}`,
      );
    }

    if (typeof expected.employeeId === "string" && step.assignedEmployeeId !== expected.employeeId) {
      throw new Error(
        `Capability assignee mismatch for ${step.capability}: ${JSON.stringify(step)}`,
      );
    }
  }

  const childTaskIds = steps.map((step: any) => step.childTaskId).filter(Boolean);
  if (childTaskIds.length !== 4) {
    throw new Error(`Expected 4 child task IDs in plan artifact: ${JSON.stringify(planArtifact)}`);
  }

  const childTasks = [];
  for (const taskId of childTaskIds) {
    const detail = await client.getTask(taskId);
    if (!(detail as any)?.ok || !(detail as any)?.task) {
      throw new Error(`Failed to fetch child task ${taskId}: ${JSON.stringify(detail)}`);
    }
    childTasks.push(detail);
  }

  const designTask = childTasks.find(
    (detail: any) => detail.task.taskType === "web_design",
  );
  const implementTask = childTasks.find(
    (detail: any) => detail.task.taskType === "web_implementation",
  );
  const deployTask = childTasks.find(
    (detail: any) => detail.task.taskType === "deployment",
  );
  const validateTask = childTasks.find(
    (detail: any) => detail.task.taskType === "verification",
  );

  if (!designTask || !implementTask || !deployTask || !validateTask) {
    throw new Error(`Missing expected child task types: ${JSON.stringify(childTasks)}`);
  }

  if (designTask.task.assignedTeamId !== "team_web_product") {
    throw new Error(`Expected design task assignedTeamId=team_web_product: ${JSON.stringify(designTask.task)}`);
  }

  if (implementTask.task.assignedTeamId !== "team_web_product") {
    throw new Error(`Expected implement task assignedTeamId=team_web_product: ${JSON.stringify(implementTask.task)}`);
  }

  if (deployTask.task.assignedTeamId !== "team_infra") {
    throw new Error(`Expected deploy task assignedTeamId=team_infra: ${JSON.stringify(deployTask.task)}`);
  }

  if (validateTask.task.assignedTeamId !== "team_validation") {
    throw new Error(`Expected validate task assignedTeamId=team_validation: ${JSON.stringify(validateTask.task)}`);
  }

  if (validateTask.task.assignedEmployeeId !== reliabilityEngineerEmployeeId) {
    throw new Error(
      `Expected validate task assignedEmployeeId=${reliabilityEngineerEmployeeId}: ${JSON.stringify(validateTask.task)}`,
    );
  }

  console.log("org-resolver-planning-defaults-check passed", {
    planningRootTaskId: planningRoot.id,
    childTaskIds,
  });
}

main().catch((error) => {
  console.error("org-resolver-planning-defaults-check failed");
  console.error(error);
  process.exit(1);
});