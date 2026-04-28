import { newId } from "@aep/shared";
import type { Project, TaskStore } from "../lib/store-types";
import { TEAM_WEB_PRODUCT } from "../org/teams";
import { getProductInitiativeContract } from "./product-initiative-contracts";

export async function bootstrapProductInitiativeTasks(args: {
  store: TaskStore;
  project: Project;
  createdByEmployeeId: string;
}): Promise<{ taskIds: string[]; threadId: string; messageId: string }> {
  const initiativeKind = args.project.initiativeKind;
  const productSurface = args.project.productSurface;

  if (!initiativeKind || !productSurface) {
    throw new Error("Product initiative bootstrap requires initiative metadata");
  }

  const contract = getProductInitiativeContract(initiativeKind);
  const planningTaskId = newId("task");
  const requirementsTaskId = newId("task");
  const graphTaskId = newId("task");
  const targetUrl = `pending://product-surface/${productSurface}`;

  await args.store.createTaskWithDependencies({
    task: {
      id: planningTaskId,
      companyId: args.project.companyId,
      originatingTeamId: args.project.ownerTeamId,
      assignedTeamId: TEAM_WEB_PRODUCT,
      createdByEmployeeId: args.createdByEmployeeId,
      taskType: "project_planning",
      title: `Plan product initiative: ${args.project.title}`,
      payload: {
        projectId: args.project.id,
        intakeRequestId: args.project.intakeRequestId ?? undefined,
        initiativeKind,
        productSurface,
        externalVisibility: args.project.externalVisibility ?? undefined,
        objectiveTitle: args.project.title,
      },
    },
    dependsOnTaskIds: [],
  });

  await args.store.createTaskWithDependencies({
    task: {
      id: requirementsTaskId,
      companyId: args.project.companyId,
      originatingTeamId: args.project.ownerTeamId,
      assignedTeamId: TEAM_WEB_PRODUCT,
      createdByEmployeeId: args.createdByEmployeeId,
      taskType: "requirements_definition",
      title: `Define requirements: ${args.project.title}`,
      payload: {
        projectId: args.project.id,
        intakeRequestId: args.project.intakeRequestId ?? undefined,
        initiativeKind,
        productSurface,
        externalVisibility: args.project.externalVisibility ?? undefined,
        objectiveTitle: args.project.title,
        sourceRef: args.project.id,
      },
    },
    dependsOnTaskIds: [planningTaskId],
  });

  await args.store.createTaskWithDependencies({
    task: {
      id: graphTaskId,
      companyId: args.project.companyId,
      originatingTeamId: args.project.ownerTeamId,
      assignedTeamId: TEAM_WEB_PRODUCT,
      createdByEmployeeId: args.createdByEmployeeId,
      taskType: "task_graph_planning",
      title: `Plan execution task graph: ${args.project.title}`,
      payload: {
        projectId: args.project.id,
        intakeRequestId: args.project.intakeRequestId ?? undefined,
        initiativeKind,
        productSurface,
        externalVisibility: args.project.externalVisibility ?? undefined,
        objectiveTitle: args.project.title,
        targetUrl,
      },
    },
    dependsOnTaskIds: [requirementsTaskId],
  });

  const threadId = newId("thread");
  const messageId = newId("message");
  const taskIds = [planningTaskId, requirementsTaskId, graphTaskId];

  await args.store.createMessageThread({
    id: threadId,
    companyId: args.project.companyId,
    topic: `Product initiative bootstrap: ${args.project.title}`,
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
    subject: "Product initiative bootstrap created",
    body:
      "Created the initial canonical planning task graph for this product initiative. " +
      "Execution remains task-backed and no product surface was implemented directly.",
    payload: {
      kind: "product_initiative_bootstrap_created",
      projectId: args.project.id,
      initiativeKind,
      productSurface,
      externalVisibility: args.project.externalVisibility ?? null,
      seedTaskTypes: contract.seedTaskTypes,
      taskIds,
    },
    requiresResponse: false,
  });

  return { taskIds, threadId, messageId: message.id };
}
