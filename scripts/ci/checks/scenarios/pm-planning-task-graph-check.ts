/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveEmployeeIdByRole } from "../../lib/employee-resolution";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";
import { resolveServiceBaseUrl } from "../../../lib/service-map";

export {};

function getTaskEntries(response: any): any[] {
  if (Array.isArray(response?.tasks)) return response.tasks;
  if (Array.isArray(response?.entries)) return response.entries;
  return [];
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
    if (handleOperatorAgentSoftSkip("pm-planning-task-graph-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  const productManagerEmployeeId = await resolveEmployeeIdByRole({
    agentBaseUrl,
    roleId: "product-manager-web",
    teamId: "team_web_product",
    runtimeStatus: "planned",
  });

  const employees = await client.listEmployees({
    teamId: "team_web_product",
  });

  if (!employees?.ok || !Array.isArray(employees.employees)) {
    throw new Error(`Failed to list employees: ${JSON.stringify(employees)}`);
  }

  const productManagerProjection = employees.employees.find(
    (employee: any) =>
      employee?.identity?.employeeId === productManagerEmployeeId
      && employee?.identity?.roleId === "product-manager-web",
  );

  if (!productManagerProjection) {
    console.warn("pm-planning-task-graph-check skipped: web PM employee is not present in this deployment");
    console.log("pm-planning-task-graph-check skipped", {
      reason: "web PM employee is not present in this deployment",
    });
    process.exit(0);
  }

  if (productManagerProjection.runtime?.runtimeStatus !== "implemented") {
    console.warn("pm-planning-task-graph-check skipped: web PM is planned-only in this deployment and cannot be executed through /agent/run");
    console.log("pm-planning-task-graph-check skipped", {
      reason: "web PM is planned-only in this deployment and cannot be executed through /agent/run",
    });
    process.exit(0);
  }

  const before = await client.listTasks({
    companyId: "company_internal_aep",
    limit: 100,
  });

  const beforeIds = new Set(getTaskEntries(before).map((task: any) => task.id));

  const result = await client.runEmployee({
    companyId: "company_internal_aep",
    teamId: "team_web_product",
    employeeId: productManagerEmployeeId,
    roleId: "product-manager-web",
    trigger: "manual",
    policyVersion: "ci-pr11b",
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
    (task: any) => task.taskType === "plan-website-delivery",
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
    (detail: any) => detail.task.taskType === "website-design",
  );
  const implementTask = childTasks.find(
    (detail: any) => detail.task.taskType === "website-implementation",
  );
  const deployTask = childTasks.find(
    (detail: any) => detail.task.taskType === "website-deployment",
  );
  const validateTask = childTasks.find(
    (detail: any) => detail.task.taskType === "validate-deployment",
  );

  if (!designTask || !implementTask || !deployTask || !validateTask) {
    throw new Error(`Missing expected child task types: ${JSON.stringify(childTasks)}`);
  }

  if (designTask.task.status !== "ready") {
    throw new Error(`Expected design task to be ready: ${JSON.stringify(designTask.task)}`);
  }

  if (implementTask.task.status !== "blocked") {
    throw new Error(`Expected implementation task to be blocked: ${JSON.stringify(implementTask.task)}`);
  }

  if (deployTask.task.status !== "blocked") {
    throw new Error(`Expected deploy task to be blocked: ${JSON.stringify(deployTask.task)}`);
  }

  if (validateTask.task.status !== "blocked") {
    throw new Error(`Expected validate task to be blocked: ${JSON.stringify(validateTask.task)}`);
  }

  const implementDeps = Array.isArray((implementTask as any)?.dependencies)
    ? (implementTask as any).dependencies
    : [];
  const deployDeps = Array.isArray((deployTask as any)?.dependencies)
    ? (deployTask as any).dependencies
    : [];
  const validateDeps = Array.isArray((validateTask as any)?.dependencies)
    ? (validateTask as any).dependencies
    : [];

  if (!implementDeps.some((dep: any) => dep.dependsOnTaskId === designTask.task.id)) {
    throw new Error(`Implementation dependency mismatch: ${JSON.stringify(implementDeps)}`);
  }

  if (!deployDeps.some((dep: any) => dep.dependsOnTaskId === implementTask.task.id)) {
    throw new Error(`Deploy dependency mismatch: ${JSON.stringify(deployDeps)}`);
  }

  if (!validateDeps.some((dep: any) => dep.dependsOnTaskId === deployTask.task.id)) {
    throw new Error(`Validation dependency mismatch: ${JSON.stringify(validateDeps)}`);
  }

  const threadDetail = await client.listMessageThreads({
    companyId: "company_internal_aep",
    relatedTaskId: planningRoot.id,
    limit: 10,
  });

  const threads = Array.isArray((threadDetail as any)?.threads)
    ? (threadDetail as any).threads
    : Array.isArray((threadDetail as any)?.entries)
      ? (threadDetail as any).entries
      : [];

  if (threads.length === 0) {
    throw new Error(`Expected planning thread for root task ${planningRoot.id}`);
  }

  console.log("pm-planning-task-graph-check passed", {
    planningRootTaskId: planningRoot.id,
    childTaskIds,
    planningThreadId: threads[0].id,
  });
}

main().catch((error) => {
  console.error("pm-planning-task-graph-check failed");
  console.error(error);
  process.exit(1);
});
