import type {
  EmployeeMessage,
  IntakeRequest,
  ProductDeploymentRecord,
  Project,
  Task,
  TaskArtifact,
  TaskStore,
} from "../lib/store-types";

export type ProductVisibilitySummary = {
  project: Project;
  intake: {
    source?: IntakeRequest | null;
    relatedCustomerIntake: IntakeRequest[];
  };
  tasks: {
    count: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    active: Task[];
    blocked: Task[];
    recent: Task[];
  };
  artifacts: {
    count: number;
    deployable: TaskArtifact[];
    recent: TaskArtifact[];
  };
  deployments: {
    count: number;
    byStatus: Record<string, number>;
    latest: ProductDeploymentRecord[];
  };
  decisions: {
    count: number;
    recent: EmployeeMessage[];
  };
  interventions: {
    pendingApprovalsLikely: boolean;
    suggestedActions: string[];
  };
};

function increment(map: Record<string, number>, key: string | undefined): void {
  const normalized = key || "unknown";
  map[normalized] = (map[normalized] ?? 0) + 1;
}

function taskBelongsToProject(task: Task, projectId: string): boolean {
  return task.payload?.projectId === projectId;
}

function artifactIsDeployable(artifact: TaskArtifact): boolean {
  return typeof artifact.content?.deployableArtifactKind === "string";
}

function messageLooksLikeDecision(message: EmployeeMessage): boolean {
  const kind = typeof message.payload?.kind === "string" ? message.payload.kind : "";
  return (
    kind.includes("decision") ||
    kind.includes("rationale") ||
    kind.includes("conversion") ||
    kind.includes("product_") ||
    message.subject?.toLowerCase().includes("decision") === true ||
    message.subject?.toLowerCase().includes("rationale") === true
  );
}

function buildSuggestedActions(args: {
  tasks: Task[];
  deployments: ProductDeploymentRecord[];
  customerIntake: IntakeRequest[];
}): string[] {
  const suggestions = new Set<string>();

  if (args.tasks.some((task) => task.status === "blocked")) {
    suggestions.add("review_blockers");
  }

  if (args.tasks.some((task) => task.taskType === "web_design" && task.status !== "completed")) {
    suggestions.add("review_design_direction");
  }

  if (args.tasks.some((task) => task.taskType === "test_execution" && task.status !== "completed")) {
    suggestions.add("review_validation_progress");
  }

  if (
    args.deployments.some((deployment) =>
      ["requested", "approved", "in_progress"].includes(deployment.status),
    )
  ) {
    suggestions.add("review_deployment_risk");
  }

  if (args.customerIntake.length > 0) {
    suggestions.add("triage_customer_feedback");
  }

  suggestions.add("add_human_direction");
  return [...suggestions];
}

export async function buildProductVisibilitySummary(args: {
  store: TaskStore;
  projectId: string;
  limit?: number;
}): Promise<ProductVisibilitySummary | null> {
  const limit = args.limit ?? 50;
  const project = await args.store.getProject(args.projectId);
  if (!project) return null;

  const sourceIntake = project.intakeRequestId
    ? await args.store.getIntakeRequest(project.intakeRequestId)
    : null;

  const intakeCandidates = await args.store.listIntakeRequests({
    companyId: project.companyId,
    limit,
  });
  const relatedCustomerIntake = intakeCandidates.filter(
    (item) =>
      item.id !== sourceIntake?.id &&
      (item.productSurface === project.productSurface ||
        item.externalSurfaceKind ||
        item.source === "external_surface"),
  );

  const companyTasks = await args.store.listTasks({
    companyId: project.companyId,
    limit: 200,
  });
  const tasks = companyTasks.filter((task) => taskBelongsToProject(task, project.id));

  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const task of tasks) {
    increment(byStatus, task.status);
    increment(byType, task.taskType);
  }

  const artifacts: TaskArtifact[] = [];
  for (const task of tasks.slice(0, limit)) {
    const taskArtifacts = await args.store.listArtifacts({
      taskId: task.id,
      limit: 20,
    });
    artifacts.push(...taskArtifacts);
  }

  const deployments = await args.store.listProductDeployments({
    projectId: project.id,
    limit,
  });
  const deploymentsByStatus: Record<string, number> = {};
  for (const deployment of deployments) {
    increment(deploymentsByStatus, deployment.status);
  }

  const threads = await args.store.listMessageThreads({
    companyId: project.companyId,
    limit,
  });
  const messages: EmployeeMessage[] = [];
  for (const thread of threads.slice(0, limit)) {
    const threadMessages = await args.store.listMessages({
      threadId: thread.id,
      limit: 20,
    });
    messages.push(
      ...threadMessages.filter(
        (message) =>
          message.payload?.projectId === project.id ||
          (message.relatedTaskId &&
            tasks.some((task) => task.id === message.relatedTaskId)),
      ),
    );
  }

  const decisionMessages = messages.filter(messageLooksLikeDecision);

  return {
    project,
    intake: {
      source: sourceIntake,
      relatedCustomerIntake: relatedCustomerIntake.slice(0, limit),
    },
    tasks: {
      count: tasks.length,
      byStatus,
      byType,
      active: tasks.filter((task) =>
        ["ready", "queued", "in_progress", "parked"].includes(task.status),
      ),
      blocked: tasks.filter((task) => task.status === "blocked"),
      recent: tasks.slice(0, limit),
    },
    artifacts: {
      count: artifacts.length,
      deployable: artifacts.filter(artifactIsDeployable).slice(0, limit),
      recent: artifacts.slice(0, limit),
    },
    deployments: {
      count: deployments.length,
      byStatus: deploymentsByStatus,
      latest: deployments.slice(0, limit),
    },
    decisions: {
      count: decisionMessages.length,
      recent: decisionMessages.slice(0, limit),
    },
    interventions: {
      pendingApprovalsLikely: deployments.some(
        (deployment) => deployment.externalVisibility === "external_safe" && !deployment.approvalId,
      ),
      suggestedActions: buildSuggestedActions({
        tasks,
        deployments,
        customerIntake: relatedCustomerIntake,
      }),
    },
  };
}