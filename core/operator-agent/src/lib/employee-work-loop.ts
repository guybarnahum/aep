import {
  thinkWithinEmployeeBoundary,
} from "@aep/operator-agent/lib/employee-cognition";
import { getEmployeePromptProfile } from "@aep/operator-agent/persistence/d1/employee-prompt-profile-store-d1";
import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type {
  EmployeeMessage,
  MessageThread,
  Task,
} from "@aep/operator-agent/lib/store-types";
import type {
  OperatorAgentEnv,
  ResolvedEmployeeRunContext,
  ResolvedTaskExecutionContext,
} from "@aep/operator-agent/types";

export type EmployeeLoopAction =
  | { type: "execute_task"; taskId: string }
  | { type: "publish_message"; threadId: string; body: string; subject?: string }
  | { type: "noop"; reason: string };

export interface EmployeeLoopLoadedContext {
  pendingTasks: Task[];
  relatedThreadsByTaskId: Record<string, MessageThread[]>;
  recentMessagesByThreadId: Record<string, EmployeeMessage[]>;
}

export interface EmployeeLoopSelectionResult {
  action: EmployeeLoopAction;
  loadedContext: EmployeeLoopLoadedContext;
}

function asStoreTask(task: ResolvedTaskExecutionContext["task"]): Task {
  return {
    id: task.id,
    companyId: task.companyId,
    originatingTeamId: task.originatingTeamId,
    assignedTeamId: task.assignedTeamId,
    ownerEmployeeId: task.ownerEmployeeId,
    assignedEmployeeId: task.assignedEmployeeId,
    createdByEmployeeId: task.createdByEmployeeId,
    taskType: task.taskType,
    title: task.title,
    status: task.status,
    payload: task.payload,
    blockingDependencyCount: task.blockingDependencyCount,
  };
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3).trim()}...`;
}

function fallbackAction(ctx: EmployeeLoopLoadedContext): EmployeeLoopAction {
  const task = ctx.pendingTasks.find(
    (entry) => entry.status === "ready" || entry.status === "queued",
  );
  if (task) {
    return { type: "execute_task", taskId: task.id };
  }

  return {
    type: "noop",
    reason: "No pending canonical work items.",
  };
}

async function loadContext(
  context: ResolvedEmployeeRunContext,
  env: OperatorAgentEnv,
): Promise<EmployeeLoopLoadedContext> {
  const store = getTaskStore(env);

  const pendingTasks = context.taskContext?.task
    ? [asStoreTask(context.taskContext.task)]
    : await store.getPendingTasksForEmployee(
        context.employee.identity.employeeId,
        context.employee.identity.teamId,
      );

  const relatedThreadsByTaskId: Record<string, MessageThread[]> = {};
  const recentMessagesByThreadId: Record<string, EmployeeMessage[]> = {};

  for (const task of pendingTasks) {
    const threads = await store.listMessageThreads({
      companyId: context.employee.identity.companyId,
      relatedTaskId: task.id,
      limit: 5,
    });

    relatedThreadsByTaskId[task.id] = threads;

    for (const thread of threads) {
      recentMessagesByThreadId[thread.id] = await store.listMessages({
        threadId: thread.id,
        limit: 5,
      });
    }
  }

  return {
    pendingTasks,
    relatedThreadsByTaskId,
    recentMessagesByThreadId,
  };
}

function buildObservations(ctx: EmployeeLoopLoadedContext): string[] {
  const out = [
    `Pending task count: ${ctx.pendingTasks.length}`,
    "Choose exactly one action: execute_task:<id> | publish_message:<threadId> | noop",
  ];

  for (const task of ctx.pendingTasks.slice(0, 5)) {
    out.push(
      `Task ${task.id} | type=${task.taskType} | status=${task.status} | title=${truncate(task.title, 120)}`,
    );
  }

  if (!ctx.pendingTasks.length) {
    out.push("No tasks available; noop is acceptable.");
  }

  return out;
}

function parseAction(
  suggested: string | undefined,
  ctx: EmployeeLoopLoadedContext,
  summary: string,
): EmployeeLoopAction | null {
  if (!suggested) return null;

  if (suggested === "noop") {
    return { type: "noop", reason: summary };
  }

  if (suggested.startsWith("execute_task:")) {
    const id = suggested.split(":")[1]?.trim();
    if (ctx.pendingTasks.some((task) => task.id === id)) {
      return { type: "execute_task", taskId: id };
    }
  }

  return null;
}

export async function selectNextEmployeeLoopAction(
  context: ResolvedEmployeeRunContext,
  env: OperatorAgentEnv,
): Promise<EmployeeLoopSelectionResult> {
  const loadedContext = await loadContext(context, env);

  if (context.taskContext?.task) {
    return {
      action: { type: "execute_task", taskId: context.taskContext.task.id },
      loadedContext,
    };
  }

  const promptProfile = await getEmployeePromptProfile(
    env,
    context.employee.identity.employeeId,
  );

  const cognition = await thinkWithinEmployeeBoundary(
    {
      employee: context.employee.identity,
      promptProfile,
      observations: buildObservations(loadedContext),
    },
    env,
  );

  const parsed = parseAction(
    cognition.structured?.suggestedNextAction,
    loadedContext,
    cognition.publicSummary,
  );

  return {
    action: parsed ?? fallbackAction(loadedContext),
    loadedContext,
  };
}