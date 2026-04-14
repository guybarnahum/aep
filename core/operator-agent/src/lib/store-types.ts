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

export type TaskStatus =
  | "queued"
  | "blocked"
  | "ready"
  | "in_progress"
  | "completed"
  | "failed"
  | "escalated";

export type TaskVerdict = "pass" | "fail" | "remediate" | "manual_escalation";

export type MessageType = "task" | "escalation" | "coordination";

export type MessageStatus = "pending" | "delivered" | "acknowledged";

export type MessageSource = "internal" | "dashboard" | "system";

export type MessageThreadVisibility = "internal" | "org";

export interface Task {
  id: string;
  companyId: string;
  originatingTeamId: string;
  assignedTeamId: string;
  ownerEmployeeId?: string;
  assignedEmployeeId?: string;
  createdByEmployeeId?: string;
  taskType: string;
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

export interface TaskStore {
  createTask(
    task: Omit<
      Task,
      | "status"
      | "blockingDependencyCount"
      | "createdAt"
      | "updatedAt"
      | "startedAt"
      | "completedAt"
      | "failedAt"
    >,
  ): Promise<void>;

  createTaskWithDependencies(args: {
    task: Omit<
      Task,
      | "status"
      | "blockingDependencyCount"
      | "createdAt"
      | "updatedAt"
      | "startedAt"
      | "completedAt"
      | "failedAt"
    >;
    dependsOnTaskIds?: string[];
  }): Promise<void>;

  getTask(taskId: string): Promise<Task | null>;
  listTasks(query: TaskListQuery): Promise<Task[]>;
  listDependencies(taskId: string): Promise<TaskDependency[]>;

  getPendingTasksForEmployee(employeeId: string, teamId: string): Promise<Task[]>;

  updateTaskStatus(taskId: string, status: TaskStatus): Promise<void>;
  recordDecision(decision: Decision): Promise<void>;

  createArtifact(
    artifact: Omit<TaskArtifact, "createdAt" | "updatedAt">,
  ): Promise<void>;

  listArtifacts(query: TaskArtifactListQuery): Promise<TaskArtifact[]>;

  createMessageThread(
    thread: Omit<MessageThread, "createdAt" | "updatedAt">,
  ): Promise<void>;

  listMessageThreads(query: ThreadListQuery): Promise<MessageThread[]>;

  getMessageThread(threadId: string): Promise<MessageThread | null>;

  getMessage(messageId: string): Promise<EmployeeMessage | null>;

  findMessageThreadByApprovalId(approvalId: string): Promise<MessageThread | null>;
  findMessageThreadByEscalationId(escalationId: string): Promise<MessageThread | null>;

  createMessage(message: Omit<EmployeeMessage, "createdAt" | "updatedAt">): Promise<void>;
  listMessages(query: MessageListQuery): Promise<EmployeeMessage[]>;
  listTasksBySourceMessageId(args: {
    sourceMessageId: string;
    limit: number;
  }): Promise<Task[]>;
}