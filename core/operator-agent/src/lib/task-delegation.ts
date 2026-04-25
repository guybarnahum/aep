import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type { Task, TaskCreateInput } from "@aep/operator-agent/lib/store-types";
import {
  getTaskContract,
  validateTaskDelegationPattern,
} from "@aep/operator-agent/lib/task-contracts";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";
import { newId } from "@aep/shared";

export class TaskDelegationError extends Error {
  readonly code: "delegation_not_allowed" | "source_task_not_found";
  readonly details?: Record<string, unknown>;

  constructor(args: {
    code: TaskDelegationError["code"];
    message: string;
    details?: Record<string, unknown>;
  }) {
    super(args.message);
    this.name = "TaskDelegationError";
    this.code = args.code;
    this.details = args.details;
  }
}

export type DelegateTaskArgs = {
  env: OperatorAgentEnv;
  sourceTaskId: string;
  delegatedByEmployeeId: string;
  delegatedTaskType: string;
  title: string;
  payload: Record<string, unknown>;
  assignedTeamId?: string;
  dependsOnSourceTask?: boolean;
};

function payloadWithDelegationProvenance(args: {
  sourceTask: Task;
  delegatedByEmployeeId: string;
  payload: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    ...args.payload,
    sourceTaskId: args.sourceTask.id,
    sourceTaskType: args.sourceTask.taskType,
    delegatedByEmployeeId: args.delegatedByEmployeeId,
    projectId: args.payload.projectId ?? args.sourceTask.payload.projectId,
    intakeRequestId: args.payload.intakeRequestId ?? args.sourceTask.payload.intakeRequestId,
  };
}

export async function delegateTaskFromSource(args: DelegateTaskArgs): Promise<{
  taskId: string;
  threadId: string;
  messageId: string;
}> {
  const store = getTaskStore(args.env);
  const sourceTask = await store.getTask(args.sourceTaskId);

  if (!sourceTask) {
    throw new TaskDelegationError({
      code: "source_task_not_found",
      message: `Source task not found: ${args.sourceTaskId}`,
      details: { sourceTaskId: args.sourceTaskId },
    });
  }

  const validation = validateTaskDelegationPattern({
    sourceTaskType: sourceTask.taskType,
    delegatedTaskType: args.delegatedTaskType,
  });

  if (!validation.ok) {
    throw new TaskDelegationError({
      code: "delegation_not_allowed",
      message: `Task ${sourceTask.taskType} cannot delegate to ${args.delegatedTaskType}`,
      details: validation,
    });
  }

  const delegatedContract = getTaskContract(args.delegatedTaskType);
  const assignedTeamId = args.assignedTeamId
    ?? delegatedContract.expectedTeamIds[0];

  const taskId = newId("task_delegated");
  const task: TaskCreateInput = {
    id: taskId,
    companyId: sourceTask.companyId,
    originatingTeamId: sourceTask.assignedTeamId,
    assignedTeamId,
    createdByEmployeeId: args.delegatedByEmployeeId,
    taskType: delegatedContract.taskType,
    title: args.title,
    payload: payloadWithDelegationProvenance({
      sourceTask,
      delegatedByEmployeeId: args.delegatedByEmployeeId,
      payload: args.payload,
    }),
    sourceThreadId: sourceTask.sourceThreadId,
    sourceMessageId: sourceTask.sourceMessageId,
  };

  await store.createTaskWithDependencies({
    task,
    dependsOnTaskIds: args.dependsOnSourceTask === false
      ? []
      : [sourceTask.id],
  });

  const threadId = newId(`thr_task_delegate_${taskId}`);
  await store.createMessageThread({
    id: threadId,
    companyId: sourceTask.companyId,
    topic: `Task delegated: ${sourceTask.id} -> ${taskId}`,
    createdByEmployeeId: args.delegatedByEmployeeId,
    relatedTaskId: taskId,
    visibility: "org",
  });

  const messageId = newId(`msg_task_delegate_${taskId}`);
  await store.createMessage({
    id: messageId,
    threadId,
    companyId: sourceTask.companyId,
    senderEmployeeId: args.delegatedByEmployeeId,
    receiverTeamId: assignedTeamId,
    type: "coordination",
    status: "delivered",
    source: "system",
    subject: "Task delegated",
    body: `Delegated ${sourceTask.taskType} task ${sourceTask.id} to ${delegatedContract.taskType} task ${taskId}.`,
    payload: {
      kind: "task_delegated",
      sourceTaskId: sourceTask.id,
      sourceTaskType: sourceTask.taskType,
      delegatedTaskId: taskId,
      delegatedTaskType: delegatedContract.taskType,
      delegatedByEmployeeId: args.delegatedByEmployeeId,
      assignedTeamId,
    },
    requiresResponse: false,
    relatedTaskId: taskId,
  });

  return { taskId, threadId, messageId };
}
