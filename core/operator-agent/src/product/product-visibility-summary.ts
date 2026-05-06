import type { ApprovalRecord } from "../types";
import type { StaffingRequestContract } from "@aep/operator-agent/hr/staffing-contracts";
import type {
  EmployeeMessage,
  IApprovalStore,
  IntakeRequest,
  ProductDeploymentRecord,
  Project,
  Task,
  TaskArtifact,
  TaskStore,
} from "../lib/store-types";
import { isProductDecisionMessage } from "./product-decision-contracts";

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
  approvals: {
    lifecyclePending: ApprovalRecord[];
    lifecycleApproved: ApprovalRecord[];
  };
  staffing: {
    blockers: Task[];
    staffingBlockers: Array<{
      taskId: string;
      taskTitle: string;
      taskType: string;
      teamId: string;
      roleId?: string;
      errorMessage: string;
      employeeSpec?: Record<string, unknown>;
      fulfillmentReady: boolean;
      fulfilledEmployeeId?: string;
      staffingRequestId?: string;
    }>;
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

function isLifecycleApprovalForProject(
  approval: ApprovalRecord,
  projectId: string,
): boolean {
  const p = approval.payload ?? {};
  return p["kind"] === "product_lifecycle_request" && p["projectId"] === projectId;
}

function inferRoleIdForStaffingBlocker(task: Task): string | undefined {
  const roleId = task.payload?.["roleId"];
  if (typeof roleId === "string" && roleId.trim()) return roleId.trim();

  if (task.taskType === "project_planning") return "product-manager-web";
  if (task.taskType === "requirements_definition") return "product-manager-web";

  return undefined;
}

function staffingRequestSourceTaskId(request: StaffingRequestContract): string | undefined {
  const specTaskId = request.employeeSpec?.sourceTaskId;
  if (typeof specTaskId === "string" && specTaskId.trim().length > 0) {
    return specTaskId.trim();
  }

  if (
    request.source.kind === "project" &&
    typeof (request.source as unknown as Record<string, unknown>)["taskId"] === "string"
  ) {
    return String((request.source as unknown as Record<string, unknown>)["taskId"]);
  }

  return undefined;
}

function fulfillmentForTask(
  staffingRequests: StaffingRequestContract[],
  taskId: string,
): StaffingRequestContract | undefined {
  return staffingRequests.find((request) => {
    if (request.state !== "fulfilled") return false;
    return staffingRequestSourceTaskId(request) === taskId;
  });
}

function buildProductStaffingBlockers(
  tasks: Task[],
  staffingRequests: StaffingRequestContract[],
): ProductVisibilitySummary["staffing"]["staffingBlockers"] {
  return tasks
    .filter((task) => {
      const message = task.errorMessage ?? "";
      return (
        message.includes("no active runtime employees") ||
        message.includes("assigned to unavailable runtime employee") ||
        message.includes("waiting_for_staffing")
      );
    })
    .map((task) => {
      const roleId = inferRoleIdForStaffingBlocker(task);
      const effectiveRoleId = roleId ?? "product-manager-web";
      const fulfilledRequest = fulfillmentForTask(staffingRequests, task.id);
      return {
        taskId: task.id,
        taskTitle: task.title,
        taskType: task.taskType,
        teamId: task.assignedTeamId,
        roleId,
        errorMessage: task.errorMessage ?? "Runtime staffing blocker",
        fulfillmentReady: Boolean(fulfilledRequest?.fulfillment?.employeeId),
        fulfilledEmployeeId: fulfilledRequest?.fulfillment?.employeeId,
        staffingRequestId: fulfilledRequest?.staffingRequestId,
        employeeSpec: {
          roleId: effectiveRoleId,
          teamId: task.assignedTeamId,
          runtimeStatus: "implemented",
          employmentStatus: "active",
          schedulerMode: "auto",
          implementationBindingRequired:
            effectiveRoleId === "product-manager-web" ? "pm-agent" : "",
          suggestedName:
            effectiveRoleId === "product-manager-web"
              ? "Web Product Manager"
              : `${effectiveRoleId} employee`,
          sourceProjectId: typeof task.payload?.projectId === "string" ? task.payload.projectId : undefined,
          sourceTaskId: task.id,
          sourceTaskType: task.taskType,
        },
      };
    });
}

export async function buildProductVisibilitySummary(args: {
  store: TaskStore;
  approvalStore?: IApprovalStore;
  staffingRequests?: StaffingRequestContract[];
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

  const artifacts = await args.store.listArtifactsForProject({
    companyId: project.companyId,
    projectId: project.id,
    limit: Math.max(limit, 200),
  });

  const deployments = await args.store.listProductDeployments({
    projectId: project.id,
    limit,
  });
  const deploymentsByStatus: Record<string, number> = {};
  for (const deployment of deployments) {
    increment(deploymentsByStatus, deployment.status);
  }

  const messages = await args.store.listMessagesForProject({
    companyId: project.companyId,
    projectId: project.id,
    limit,
  });
  const decisionMessages = messages.filter(isProductDecisionMessage);

  let lifecyclePending: ApprovalRecord[] = [];
  let lifecycleApproved: ApprovalRecord[] = [];
  if (args.approvalStore) {
    const [pendingRaw, approvedRaw] = await Promise.all([
      args.approvalStore.list({ limit: 50, status: "pending", companyId: project.companyId }),
      args.approvalStore.list({ limit: 50, status: "approved", companyId: project.companyId }),
    ]);
    lifecyclePending = pendingRaw.filter((a) => isLifecycleApprovalForProject(a, project.id));
    lifecycleApproved = approvedRaw.filter(
      (a) => isLifecycleApprovalForProject(a, project.id) && !a.executedAt,
    );
  }

  const blockers = tasks.filter((task) => task.status === "blocked");
  const staffingBlockers = buildProductStaffingBlockers(
    tasks,
    args.staffingRequests ?? [],
  );

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
      blocked: blockers,
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
    approvals: {
      lifecyclePending,
      lifecycleApproved,
    },
    staffing: {
      blockers,
      staffingBlockers,
    },
  };
}