import { newId } from "@aep/shared";
import type { Project, TaskStore } from "../lib/store-types";
import { TEAM_INFRA, TEAM_VALIDATION, TEAM_WEB_PRODUCT } from "../org/teams";

export type ProductExecutionGraphResult = {
  taskIds: {
    webDesignTaskId: string;
    webImplementationTaskId: string;
    testExecutionTaskId: string;
    deploymentTaskId: string;
    verificationTaskId: string;
    monitoringSetupTaskId: string;
  };
  threadId: string;
  messageId: string;
};

export async function createProductExecutionGraph(args: {
  store: TaskStore;
  project: Project;
  createdByEmployeeId: string;
  environment: string;
  targetUrl?: string;
  requirementsRef?: string;
  testPlanRef?: string;
  artifactRef?: string;
}): Promise<ProductExecutionGraphResult> {
  if (!args.project.initiativeKind || !args.project.productSurface) {
    throw new Error("Product execution requires a product initiative project");
  }

  const targetUrl =
    args.targetUrl?.trim() ||
    `pending://product-surface/${args.project.productSurface}`;
  const requirementsRef =
    args.requirementsRef?.trim() ||
    `project:${args.project.id}:requirements`;
  const testPlanRef =
    args.testPlanRef?.trim() ||
    `project:${args.project.id}:test-plan`;
  const artifactRef =
    args.artifactRef?.trim() ||
    `project:${args.project.id}:deployment-candidate`;

  const webDesignTaskId = newId("task");
  const webImplementationTaskId = newId("task");
  const testExecutionTaskId = newId("task");
  const deploymentTaskId = newId("task");
  const verificationTaskId = newId("task");
  const monitoringSetupTaskId = newId("task");

  const commonPayload = {
    projectId: args.project.id,
    intakeRequestId: args.project.intakeRequestId ?? undefined,
    initiativeKind: args.project.initiativeKind,
    productSurface: args.project.productSurface,
    externalVisibility: args.project.externalVisibility ?? undefined,
  };

  await args.store.createTaskWithDependencies({
    task: {
      id: webDesignTaskId,
      companyId: args.project.companyId,
      originatingTeamId: args.project.ownerTeamId,
      assignedTeamId: TEAM_WEB_PRODUCT,
      createdByEmployeeId: args.createdByEmployeeId,
      taskType: "web_design",
      title: `Design product surface: ${args.project.title}`,
      payload: {
        ...commonPayload,
        targetUrl,
        objectiveTitle: args.project.title,
      },
    },
    dependsOnTaskIds: [],
  });

  await args.store.createTaskWithDependencies({
    task: {
      id: webImplementationTaskId,
      companyId: args.project.companyId,
      originatingTeamId: args.project.ownerTeamId,
      assignedTeamId: TEAM_WEB_PRODUCT,
      createdByEmployeeId: args.createdByEmployeeId,
      taskType: "web_implementation",
      title: `Implement product surface: ${args.project.title}`,
      payload: {
        ...commonPayload,
        targetUrl,
        requirementsRef,
      },
    },
    dependsOnTaskIds: [webDesignTaskId],
  });

  await args.store.createTaskWithDependencies({
    task: {
      id: testExecutionTaskId,
      companyId: args.project.companyId,
      originatingTeamId: args.project.ownerTeamId,
      assignedTeamId: TEAM_VALIDATION,
      createdByEmployeeId: args.createdByEmployeeId,
      taskType: "test_execution",
      title: `Validate product surface: ${args.project.title}`,
      payload: {
        ...commonPayload,
        targetUrl,
        testPlanRef,
      },
    },
    dependsOnTaskIds: [webImplementationTaskId],
  });

  await args.store.createTaskWithDependencies({
    task: {
      id: deploymentTaskId,
      companyId: args.project.companyId,
      originatingTeamId: args.project.ownerTeamId,
      assignedTeamId: TEAM_INFRA,
      createdByEmployeeId: args.createdByEmployeeId,
      taskType: "deployment",
      title: `Prepare deployment: ${args.project.title}`,
      payload: {
        ...commonPayload,
        environment: args.environment,
        artifactRef,
      },
    },
    dependsOnTaskIds: [testExecutionTaskId],
  });

  await args.store.createTaskWithDependencies({
    task: {
      id: verificationTaskId,
      companyId: args.project.companyId,
      originatingTeamId: args.project.ownerTeamId,
      assignedTeamId: TEAM_VALIDATION,
      createdByEmployeeId: args.createdByEmployeeId,
      taskType: "verification",
      title: `Verify deployment readiness: ${args.project.title}`,
      payload: {
        ...commonPayload,
        targetUrl,
        subjectRef: artifactRef,
      },
    },
    dependsOnTaskIds: [deploymentTaskId],
  });

  await args.store.createTaskWithDependencies({
    task: {
      id: monitoringSetupTaskId,
      companyId: args.project.companyId,
      originatingTeamId: args.project.ownerTeamId,
      assignedTeamId: TEAM_INFRA,
      createdByEmployeeId: args.createdByEmployeeId,
      taskType: "monitoring_setup",
      title: `Set up monitoring: ${args.project.title}`,
      payload: {
        ...commonPayload,
        environment: args.environment,
        targetUrl,
      },
    },
    dependsOnTaskIds: [deploymentTaskId],
  });

  const threadId = newId("thread");
  const messageId = newId("message");

  await args.store.createMessageThread({
    id: threadId,
    companyId: args.project.companyId,
    topic: `Product execution graph created: ${args.project.title}`,
    createdByEmployeeId: args.createdByEmployeeId,
    visibility: "org",
  });

  const message = await args.store.createMessage({
    id: messageId,
    threadId,
    companyId: args.project.companyId,
    senderEmployeeId: args.createdByEmployeeId,
    receiverTeamId: args.project.ownerTeamId,
    type: "coordination",
    status: "delivered",
    source: "system",
    subject: "Product execution graph created",
    body:
      "Created a canonical product execution task graph. " +
      "The product will be built, validated, prepared for deployment, verified, and monitored through ordinary AEP tasks.",
    payload: {
      kind: "product_execution_graph_created",
      projectId: args.project.id,
      taskIds: {
        webDesignTaskId,
        webImplementationTaskId,
        testExecutionTaskId,
        deploymentTaskId,
        verificationTaskId,
        monitoringSetupTaskId,
      },
    },
    requiresResponse: false,
  });

  return {
    taskIds: {
      webDesignTaskId,
      webImplementationTaskId,
      testExecutionTaskId,
      deploymentTaskId,
      verificationTaskId,
      monitoringSetupTaskId,
    },
    threadId,
    messageId: message.id,
  };
}