import type {
  AgentRoleId,
  AgentWorkLogEntry,
  ApprovalRecord,
  ApprovalStatus,
  EmployeeControlHistoryRecord,
  EmployeeControlRecord,
  EscalationRecord,
  EscalationState,
  ManagerDecision,
  ResolvedEmployeeControl,
} from "@aep/operator-agent/types";
import type {
  ExternalMessageProjection,
  ExternalThreadProjection,
  MirrorChannel,
  MirrorDeliveryRecord,
} from "@aep/operator-agent/adapters/types";
import type { CanonicalTaskType } from "./task-contracts";
import type {
  ProductExternalVisibility,
  ProductInitiativeKind,
  ProductSurface,
} from "../product/product-initiative-contracts";
import type { ExternalSurfaceKind } from "../product/external-surface-contracts";

export interface IApprovalStore {
  write(record: ApprovalRecord): Promise<void>;
  get(approvalId: string): Promise<ApprovalRecord | null>;
  put(record: ApprovalRecord): Promise<void>;
  update(record: ApprovalRecord): Promise<void>;
  decide(args: {
    approvalId: string;
    nextStatus: "approved" | "rejected";
    decidedBy: string;
    decisionNote?: string;
    decidedAt?: string;
  }): Promise<
    | { ok: true; approval: ApprovalRecord }
    | {
        ok: false;
        reason: "not_found" | "already_decided";
        approval?: ApprovalRecord;
      }
  >;
  markExecuted(args: {
    approvalId: string;
    executedAt: string;
    executionId: string;
    executedByEmployeeId?: string;
    executedByRoleId?: AgentRoleId;
  }): Promise<
    | { ok: true; approval: ApprovalRecord }
    | {
        ok: false;
        reason:
          | "not_found"
          | "not_approved"
          | "already_executed"
          | "expired";
        approval?: ApprovalRecord;
      }
  >;
  list(args: {
    limit: number;
    status?: ApprovalStatus;
    employeeId?: string;
    companyId?: string;
    actionType?: string;
    targetEmployeeId?: string;
  }): Promise<ApprovalRecord[]>;
  findLatestDecisionForAction(args: {
    actionType: string;
    targetEmployeeId: string;
  }): Promise<ApprovalRecord | null>;
  findLatestApprovedDecisionForAction(args: {
    actionType: string;
    targetEmployeeId: string;
  }): Promise<ApprovalRecord | null>;
}

export interface IEmployeeControlStore {
  get(employeeId: string): Promise<EmployeeControlRecord | null>;
  put(record: EmployeeControlRecord): Promise<void>;
  clear(employeeId: string): Promise<void>;
  getEffective(employeeId: string, nowIso: string): Promise<ResolvedEmployeeControl>;
  isBlocked(control: EmployeeControlRecord | null): boolean;
}

export interface IEmployeeControlHistoryStore {
  write(record: EmployeeControlHistoryRecord): Promise<void>;
  list(args: { employeeId?: string; limit: number }): Promise<EmployeeControlHistoryRecord[]>;
}

export interface IEscalationStore {
  write(record: EscalationRecord): Promise<void>;
  get(escalationId: string): Promise<EscalationRecord | null>;
  put(record: EscalationRecord): Promise<void>;
  list(limit: number, stateFilter?: EscalationState): Promise<EscalationRecord[]>;
}

export interface IManagerDecisionStore {
  write(entry: ManagerDecision): Promise<void>;
  list(args: { managerEmployeeId: string; limit: number }): Promise<ManagerDecision[]>;
}

export interface IAgentWorkLogStore {
  write(entry: AgentWorkLogEntry): Promise<void>;
  listByEmployee(args: { employeeId: string; limit: number }): Promise<AgentWorkLogEntry[]>;
}

export type IntakeRequestStatus =
  | "submitted"
  | "triaged"
  | "converted"
  | "rejected";

export type IntakeRequest = {
  id: string;
  companyId: string;
  title: string;
  description?: string | null;
  requestedBy: string;
  source: string;
  externalSurfaceKind?: ExternalSurfaceKind | null;
  productSurface?: ProductSurface | null;
  sourceUrl?: string | null;
  idempotencyKey?: string | null;
  customerContact?: Record<string, unknown> | null;
  status: IntakeRequestStatus;
  createdAt: string;
};

export type IntakeListQuery = {
  companyId?: string;
  externalSurfaceKind?: ExternalSurfaceKind;
  idempotencyKey?: string;
  limit?: number;
};

export type IntakeStatusUpdate = {
  id: string;
  status: IntakeRequestStatus;
};

export type ProjectStatus =
  | "active"
  | "paused"
  | "completed"
  | "archived";

export type Project = {
  id: string;
  companyId: string;
  intakeRequestId?: string | null;
  createdByEmployeeId?: string | null;
  title: string;
  description?: string | null;
  ownerTeamId: string;
  initiativeKind?: ProductInitiativeKind | null;
  productSurface?: ProductSurface | null;
  externalVisibility?: ProductExternalVisibility | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  archivedAt?: string | null;
};

export type ProjectListQuery = {
  companyId?: string;
  ownerTeamId?: string;
  status?: ProjectStatus;
  intakeRequestId?: string;
  initiativeKind?: ProductInitiativeKind;
  productSurface?: ProductSurface;
  limit?: number;
};

export type TaskStatus =
  | "queued"
  | "blocked"
  | "ready"
  | "in_progress"
  | "parked"
  | "completed"
  | "failed"
  | "escalated";

export type TaskVerdict = "pass" | "fail" | "remediate" | "manual_escalation";

export type MessageType = "task" | "escalation" | "coordination";

export type MessageStatus = "pending" | "delivered" | "acknowledged";

export type MessageSource =
  | "internal"
  | "dashboard"
  | "system"
  | "human"
  | "slack"
  | "email";

export type MessageThreadVisibility = "internal" | "org";

export interface Task {
  id: string;
  companyId: string;
  originatingTeamId: string;
  assignedTeamId: string;
  ownerEmployeeId?: string;
  assignedEmployeeId?: string;
  createdByEmployeeId?: string;
  taskType: CanonicalTaskType;
  title: string;
  status: TaskStatus;
  payload: Record<string, unknown>;
  blockingDependencyCount: number;
  sourceThreadId?: string;
  sourceMessageId?: string;
  sourceApprovalId?: string;
  sourceEscalationId?: string;
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
}

export interface TaskDependency {
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: "completion";
  createdAt?: string;
}

export type TaskDependencyValidationErrorCode =
  | "self_dependency"
  | "duplicate_dependency"
  | "dependency_not_found"
  | "cross_company_dependency"
  | "dependency_cycle";

export class TaskDependencyValidationError extends Error {
  readonly code: TaskDependencyValidationErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: TaskDependencyValidationErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "TaskDependencyValidationError";
    this.code = code;
    this.details = details;
  }
}

export type TaskArtifactType = "plan" | "result" | "evidence";

export type ProductDeploymentStatus =
  | "requested"
  | "approved"
  | "in_progress"
  | "deployed"
  | "failed"
  | "canceled";

export interface ProductDeploymentRecord {
  id: string;
  companyId: string;
  projectId: string;
  sourceTaskId: string;
  sourceArtifactId: string;
  requestedByEmployeeId: string;
  environment: string;
  targetUrl?: string | null;
  externalVisibility: "internal_only" | "external_safe";
  status: ProductDeploymentStatus;
  approvalId?: string | null;
  deploymentTarget: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  deployedAt?: string | null;
  failedAt?: string | null;
  canceledAt?: string | null;
}

export interface ProductDeploymentListQuery {
  companyId?: string;
  projectId?: string;
  sourceArtifactId?: string;
  status?: ProductDeploymentStatus;
  limit?: number;
}

export interface TaskArtifact {
  id: string;
  taskId: string;
  companyId: string;
  artifactType: TaskArtifactType;
  createdByEmployeeId?: string;
  summary?: string;
  content: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface MessageThread {
  id: string;
  companyId: string;
  topic: string;
  createdByEmployeeId?: string;
  relatedTaskId?: string;
  relatedArtifactId?: string;
  relatedApprovalId?: string;
  relatedEscalationId?: string;
  visibility: MessageThreadVisibility;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeMessage {
  id: string;
  threadId: string;
  companyId: string;
  senderEmployeeId: string;
  receiverEmployeeId?: string;
  receiverTeamId?: string;
  type: MessageType;
  status: MessageStatus;
  source: MessageSource;
  subject?: string;
  body: string;
  payload: Record<string, unknown>;
  externalMessageId?: string;
  externalChannel?: "slack" | "email";
  externalAuthorId?: string;
  externalReceivedAt?: string;
  requiresResponse: boolean;
  responseActionType?: string;
  responseActionStatus?: "requested" | "applied" | "rejected";
  causedStateTransition?: boolean;
  relatedTaskId?: string;
  relatedArtifactId?: string;
  relatedEscalationId?: string;
  relatedApprovalId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ThreadExternalInteractionPolicy = {
  threadId: string;
  inboundRepliesAllowed: boolean;
  externalActionsAllowed: boolean;
  allowedChannels?: Array<"slack" | "email">;
  allowedTargets?: string[];
  allowedExternalActors?: string[];
  createdAt: string;
  updatedAt: string;
};

export type ExternalInteractionAuditRecord = {
  id: string;
  threadId?: string;
  channel: "slack" | "email";
  interactionKind: "reply" | "action";
  externalActorId?: string;
  externalMessageId?: string;
  externalActionId?: string;
  decision: "allowed" | "denied";
  reasonCode: string;
  createdAt: string;
};

export interface Decision {
  id: string;
  taskId: string;
  employeeId: string;
  verdict: TaskVerdict;
  reasoning: string;
  internalMonologue?: string; // private; never exposed on coordination routes
  evidenceTraceId?: string;
  createdAt?: string;
}

export interface TaskListQuery {
  companyId?: string;
  assignedTeamId?: string;
  assignedEmployeeId?: string;
  status?: TaskStatus;
  limit: number;
}

export interface MessageListQuery {
  threadId?: string;
  senderEmployeeId?: string;
  receiverEmployeeId?: string;
  receiverTeamId?: string;
  relatedTaskId?: string;
  relatedArtifactId?: string;
  limit: number;
}

export interface ThreadListQuery {
  companyId?: string;
  createdByEmployeeId?: string;
  relatedTaskId?: string;
  relatedArtifactId?: string;
  relatedApprovalId?: string;
  relatedEscalationId?: string;
  participantEmployeeId?: string;
  limit: number;
}

export interface MessageThreadDetail {
  thread: MessageThread;
  messages: EmployeeMessage[];
}

export interface TaskArtifactListQuery {
  taskId: string;
  artifactType?: TaskArtifactType;
  limit: number;
}

export type TaskCreateInput = Omit<
  Task,
  | "status"
  | "blockingDependencyCount"
  | "createdAt"
  | "updatedAt"
  | "startedAt"
  | "completedAt"
  | "failedAt"
  | "taskType"
> & {
  taskType: string;
};

export interface TaskStore {
  createTask(task: TaskCreateInput): Promise<void>;

  createTaskWithDependencies(args: {
    task: TaskCreateInput;
    dependsOnTaskIds?: string[];
  }): Promise<void>;

  getTask(taskId: string): Promise<Task | null>;
  listTasks(query: TaskListQuery): Promise<Task[]>;
  listDependencies(taskId: string): Promise<TaskDependency[]>;

  getPendingTasksForEmployee(employeeId: string, teamId: string): Promise<Task[]>;
  getPendingTasksForTeam(args: { teamId: string; limit: number }): Promise<Task[]>;

  createIntakeRequest(args: IntakeRequest): Promise<void>;
  getIntakeRequest(id: string): Promise<IntakeRequest | null>;
  listIntakeRequests(query: IntakeListQuery): Promise<IntakeRequest[]>;
  updateIntakeRequestStatus(args: IntakeStatusUpdate): Promise<void>;

  createProject(args: Project): Promise<void>;
  getProject(id: string): Promise<Project | null>;
  listProjects(query: ProjectListQuery): Promise<Project[]>;

  updateTaskStatus(taskId: string, status: TaskStatus): Promise<void>;
  parkTask(args: {
    taskId: string;
    parkedByEmployeeId: string;
    reason: string;
    managerDecisionId: string;
  }): Promise<void>;
  recordDecision(decision: Decision): Promise<void>;

  createArtifact(
    artifact: Omit<TaskArtifact, "createdAt" | "updatedAt">,
  ): Promise<void>;

  getArtifact(artifactId: string): Promise<TaskArtifact | null>;

  listArtifacts(query: TaskArtifactListQuery): Promise<TaskArtifact[]>;
  listArtifactsForProject(query: {
    companyId: string;
    projectId: string;
    artifactType?: TaskArtifact["artifactType"];
    limit: number;
  }): Promise<TaskArtifact[]>;

  createProductDeployment(record: ProductDeploymentRecord): Promise<void>;
  getProductDeployment(deploymentId: string): Promise<ProductDeploymentRecord | null>;
  listProductDeployments(
    query: ProductDeploymentListQuery,
  ): Promise<ProductDeploymentRecord[]>;
  updateProductDeploymentStatus(args: {
    deploymentId: string;
    status: ProductDeploymentStatus;
    approvalId?: string | null;
    targetUrl?: string | null;
  }): Promise<ProductDeploymentRecord | null>;

  createMessageThread(
    thread: Omit<MessageThread, "createdAt" | "updatedAt">,
  ): Promise<void>;

  listMessageThreads(query: ThreadListQuery): Promise<MessageThread[]>;

  getMessageThread(threadId: string): Promise<MessageThread | null>;

  getMessage(messageId: string): Promise<EmployeeMessage | null>;
  createMessageMirrorDelivery(delivery: MirrorDeliveryRecord): Promise<void>;
  listMessageMirrorDeliveries(messageId: string): Promise<MirrorDeliveryRecord[]>;
  createExternalThreadProjection(projection: ExternalThreadProjection): Promise<void>;
  getExternalThreadProjection(args: {
    threadId: string;
    channel: MirrorChannel;
    target: string;
  }): Promise<ExternalThreadProjection | null>;
  listExternalThreadProjections(threadId: string): Promise<ExternalThreadProjection[]>;
  listExternalThreadProjectionsByExternal(input: {
    channel: MirrorChannel;
    externalThreadId: string;
    target?: string;
  }): Promise<ExternalThreadProjection[]>;
  findThreadByExternalThreadId(input: {
    externalThreadId: string;
    source: "slack" | "email";
  }): Promise<MessageThread | null>;
  getThreadExternalInteractionPolicy(threadId: string): Promise<ThreadExternalInteractionPolicy | null>;
  upsertThreadExternalInteractionPolicy(policy: ThreadExternalInteractionPolicy): Promise<void>;
  createExternalMessageProjection(projection: ExternalMessageProjection): Promise<void>;
  getExternalMessageProjection(args: {
    messageId: string;
    channel: MirrorChannel;
    target: string;
  }): Promise<ExternalMessageProjection | null>;
  listExternalMessageProjections(messageId: string): Promise<ExternalMessageProjection[]>;
  createExternalActionRecord(input: {
    externalActionId: string;
    source: "slack" | "email";
    threadId: string;
    actionType: string;
  }): Promise<{ alreadyExists: boolean }>;
  createExternalInteractionAudit(record: ExternalInteractionAuditRecord): Promise<void>;
  listExternalInteractionAudit(threadId: string): Promise<ExternalInteractionAuditRecord[]>;

  findMessageThreadByApprovalId(approvalId: string): Promise<MessageThread | null>;
  findMessageThreadByEscalationId(escalationId: string): Promise<MessageThread | null>;

  createMessage(message: Omit<EmployeeMessage, "createdAt" | "updatedAt">): Promise<EmployeeMessage>;
  listMessages(query: MessageListQuery): Promise<EmployeeMessage[]>;
  listMessagesForProject(query: {
    companyId: string;
    projectId: string;
    limit: number;
  }): Promise<EmployeeMessage[]>;
}