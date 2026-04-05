import { logInfo } from "@aep/operator-agent/lib/logger";
import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type { Task } from "@aep/operator-agent/lib/store-types";
import type {
  OperatorAgentEnv,
  ResolvedEmployeeRunContext,
  ValidationAgentResponse,
  ValidationTaskDecision,
} from "@aep/operator-agent/types";

const VALIDATION_TASK_TYPE = "validate-deployment";
const HEALTH_CHECK_TIMEOUT_MS = 5_000;

function decisionId(taskId: string): string {
  return `dec_${taskId}_${crypto.randomUUID().split("-")[0]}`;
}

function getRequestedWorkOrderId(
  context: ResolvedEmployeeRunContext,
): string | undefined {
  return context.request.workOrderId ?? context.executionContext?.workOrderId;
}

function getEvidenceTraceId(
  context: ResolvedEmployeeRunContext,
): string | undefined {
  return (
    context.executionContext?.taskId ??
    context.executionContext?.workOrderId ??
    context.request.taskId ??
    context.request.workOrderId
  );
}

function requireTargetUrl(task: Task): string {
  const targetUrl = task.payload.targetUrl;
  if (typeof targetUrl !== "string" || targetUrl.trim().length === 0) {
    throw new Error(`Task ${task.id} is missing payload.targetUrl`);
  }

  return targetUrl;
}

async function loadTasksForRun(
  env: OperatorAgentEnv,
  context: ResolvedEmployeeRunContext,
): Promise<Task[]> {
  const taskStore = getTaskStore(env);
  const requestedWorkOrderId = getRequestedWorkOrderId(context);

  if (requestedWorkOrderId) {
    const task = await taskStore.getTask(requestedWorkOrderId);
    if (!task) {
      throw new Error(`Work order ${requestedWorkOrderId} not found`);
    }
    return [task];
  }

  return taskStore.getPendingTasksForEmployee(
    context.employee.identity.employeeId,
    context.employee.identity.teamId,
  );
}

async function runHealthCheck(targetUrl: string): Promise<{
  verdict: "pass" | "remediate";
  reasoning: string;
  statusCode?: number;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), HEALTH_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        verdict: "remediate",
        reasoning: `Target returned status ${response.status}. Triggering self-healing rollback.`,
        statusCode: response.status,
      };
    }

    return {
      verdict: "pass",
      reasoning: `Health check passed for ${targetUrl}`,
      statusCode: response.status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      verdict: "remediate",
      reasoning: `Failed to reach target: ${message}. Platform integrity at risk.`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function recordTaskDecision(args: {
  env: OperatorAgentEnv;
  context: ResolvedEmployeeRunContext;
  task: Task;
  verdict: ValidationTaskDecision["verdict"];
  reasoning: string;
}): Promise<void> {
  const taskStore = getTaskStore(args.env);
  await taskStore.recordDecision({
    id: decisionId(args.task.id),
    taskId: args.task.id,
    employeeId: args.context.employee.identity.employeeId,
    verdict: args.verdict,
    reasoning: args.reasoning,
    evidenceTraceId: getEvidenceTraceId(args.context),
  });
}

async function processValidationTask(args: {
  env: OperatorAgentEnv;
  context: ResolvedEmployeeRunContext;
  task: Task;
  shouldClaim: boolean;
}): Promise<ValidationTaskDecision> {
  const taskStore = getTaskStore(args.env);

  if (args.shouldClaim && args.task.status !== "in-progress") {
    await taskStore.updateTaskStatus(args.task.id, "in-progress");
  }

  try {
    const targetUrl = requireTargetUrl(args.task);
    const healthCheck = await runHealthCheck(targetUrl);

    await recordTaskDecision({
      env: args.env,
      context: args.context,
      task: args.task,
      verdict: healthCheck.verdict,
      reasoning: healthCheck.reasoning,
    });

    const decision: ValidationTaskDecision = {
      taskId: args.task.id,
      taskType: args.task.taskType,
      targetUrl,
      verdict: healthCheck.verdict,
      reasoning: healthCheck.reasoning,
      statusCode: healthCheck.statusCode,
    };

    logInfo("validation task processed", {
      employeeId: args.context.employee.identity.employeeId,
      taskId: args.task.id,
      verdict: decision.verdict,
      targetUrl,
    });

    return decision;
  } catch (error) {
    const reasoning = error instanceof Error ? error.message : String(error);

    await recordTaskDecision({
      env: args.env,
      context: args.context,
      task: args.task,
      verdict: "fail",
      reasoning,
    });

    logInfo("validation task failed", {
      employeeId: args.context.employee.identity.employeeId,
      taskId: args.task.id,
      reasoning,
    });

    return {
      taskId: args.task.id,
      taskType: args.task.taskType,
      verdict: "fail",
      reasoning,
    };
  }
}

export async function runValidationAgent(
  context: ResolvedEmployeeRunContext,
  env?: OperatorAgentEnv,
): Promise<ValidationAgentResponse> {
  if (!env) {
    throw new Error("Reliability Engineer requires OPERATOR_AGENT_DB-backed execution");
  }

  const tasks = await loadTasksForRun(env, context);
  const requestedWorkOrderId = getRequestedWorkOrderId(context);
  const decisions: ValidationTaskDecision[] = [];

  for (const task of tasks) {
    if (task.taskType !== VALIDATION_TASK_TYPE) {
      if (requestedWorkOrderId && task.id === requestedWorkOrderId) {
        const reasoning = `Work order ${task.id} uses unsupported taskType ${task.taskType}`;
        await recordTaskDecision({
          env,
          context,
          task,
          verdict: "manual_escalation",
          reasoning,
        });
        decisions.push({
          taskId: task.id,
          taskType: task.taskType,
          verdict: "manual_escalation",
          reasoning,
        });
      }
      continue;
    }

    decisions.push(
      await processValidationTask({
        env,
        context,
        task,
        shouldClaim: !requestedWorkOrderId,
      }),
    );
  }

  const processed = decisions.length;
  const passed = decisions.filter((decision) => decision.verdict === "pass").length;
  const failed = decisions.filter((decision) => decision.verdict === "fail").length;
  const remediations = decisions.filter((decision) => decision.verdict === "remediate").length;
  const ignored = Math.max(tasks.length - processed, 0);

  return {
    ok: true,
    status: "completed",
    policyVersion: context.policyVersion,
    trigger: context.request.trigger,
    employee: context.employee.identity,
    workerRole: "reliability-engineer",
    baseAuthority: context.employee.authority,
    baseBudget: context.employee.budget,
    authority: context.authority,
    budget: context.budget,
    dryRun: false,
    scanned: {
      tasks: tasks.length,
      eligibleTasks: tasks.filter((task) => task.taskType === VALIDATION_TASK_TYPE).length,
    },
    decisions,
    summary: {
      processed,
      passed,
      failed,
      remediations,
      ignored,
    },
    message: `Processed ${processed} validation tasks.`,
  };
}