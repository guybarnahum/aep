import {
  derivePublicRationale,
  loadEmployeeCognitionInputForRun,
  thinkWithinEmployeeBoundary,
} from "@aep/operator-agent/lib/employee-cognition";
import {
  selectNextEmployeeLoopAction,
} from "@aep/operator-agent/lib/employee-work-loop";
import { logInfo } from "@aep/operator-agent/lib/logger";
import { publishTaskRationaleToThread } from "@aep/operator-agent/lib/rationale-thread-publisher";
import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type { Task } from "@aep/operator-agent/lib/store-types";
import { newId } from "@aep/shared";
import type {
  EmployeePublicRationalePresentationStyle,
  OperatorAgentEnv,
  ResolvedEmployeeRunContext,
  ValidationAgentResponse,
  ValidationFinding,
  ValidationResultArtifact,
  ValidationResultStatus,
  ValidationTaskDecision,
} from "@aep/operator-agent/types";

const VALIDATION_TASK_TYPE = "validate-deployment";
const HEALTH_CHECK_TIMEOUT_MS = 5_000;

function decisionId(taskId: string): string {
  return newId(`dec_${taskId}`);
}

function publicRationaleArtifactId(taskId: string): string {
  return newId(`art_pubrat_${taskId}`);
}

function validationResultArtifactId(taskId: string): string {
  return newId(`art_valres_${taskId}`);
}

function getRequestedTaskId(
  context: ResolvedEmployeeRunContext,
): string | undefined {
  return (
    context.request.taskId
    ?? context.request.workOrderId
    ?? context.executionContext?.taskId
    ?? context.executionContext?.workOrderId
  );
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

function shouldUseControlPlaneBinding(task: Task): boolean {
  return task.payload.useControlPlaneBinding === true;
}

async function loadTasksForRun(
  env: OperatorAgentEnv,
  context: ResolvedEmployeeRunContext,
): Promise<Task[]> {
  if (context.taskContext?.task) {
    return [context.taskContext.task];
  }

  const taskStore = getTaskStore(env);
  const requestedTaskId = getRequestedTaskId(context);

  if (requestedTaskId) {
    const task = await taskStore.getTask(requestedTaskId);
    if (!task) {
      throw new Error(`Task ${requestedTaskId} not found`);
    }
    return [task];
  }

  return taskStore.getPendingTasksForEmployee(
    context.employee.identity.employeeId,
    context.employee.identity.teamId,
  );
}

async function runHealthCheck(args: {
  targetUrl: string;
  env: OperatorAgentEnv;
  useControlPlaneBinding: boolean;
}): Promise<{
  verdict: "pass" | "remediate";
  reasoning: string;
  statusCode?: number;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), HEALTH_CHECK_TIMEOUT_MS);

  try {
    const response = await (async () => {
      if (args.useControlPlaneBinding && args.env.CONTROL_PLANE) {
        const url = new URL(args.targetUrl);
        return args.env.CONTROL_PLANE.fetch(
          new Request(`https://control-plane${url.pathname}${url.search}`, {
            method: "GET",
            signal: controller.signal,
          }),
        );
      }

      return fetch(args.targetUrl, {
        method: "GET",
        signal: controller.signal,
      });
    })();

    if (!response.ok) {
      return {
        verdict: "remediate",
        reasoning: `Target returned status ${response.status}. Triggering self-healing rollback.`,
        statusCode: response.status,
      };
    }

    return {
      verdict: "pass",
      reasoning: `Health check passed for ${args.targetUrl}`,
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

function toValidationResult(args: {
  targetUrl?: string;
  taskType: string;
  verdict: ValidationTaskDecision["verdict"];
  reasoning: string;
  statusCode?: number;
}): ValidationResultArtifact & {
  recommendedNextAction?: string;
} {
  if (args.verdict === "pass") {
    const findings: ValidationFinding[] = [
      {
        severity: "info",
        message: args.reasoning,
      },
    ];

    return {
      kind: "validation_result",
      status: "pass",
      summary: `Validation passed for ${args.taskType}.`,
      findings,
      targetUrl: args.targetUrl,
      statusCode: args.statusCode,
    };
  }

  if (args.verdict === "manual_escalation") {
    const findings: ValidationFinding[] = [
      {
        severity: "warning",
        message: args.reasoning,
      },
    ];

    return {
      kind: "validation_result",
      status: "warning",
      summary: `Validation requires manual escalation for ${args.taskType}.`,
      findings,
      targetUrl: args.targetUrl,
      statusCode: args.statusCode,
      recommendedNextAction: "review_validation_exception",
    };
  }

  const findings: ValidationFinding[] = [
    {
      severity: "error",
      message: args.reasoning,
      evidence: typeof args.statusCode === "number"
        ? `status_code:${args.statusCode}`
        : undefined,
    },
  ];

  return {
    kind: "validation_result",
    status: "fail",
    summary: `Validation failed for ${args.taskType}.`,
    findings,
    targetUrl: args.targetUrl,
    statusCode: args.statusCode,
    recommendedNextAction:
      args.verdict === "remediate"
        ? "create_remediation_followup"
        : "investigate_validation_failure",
  };
}

async function recordTaskDecision(args: {
  env: OperatorAgentEnv;
  context: ResolvedEmployeeRunContext;
  task: Task;
  verdict: ValidationTaskDecision["verdict"];
  reasoning: string;
  internalMonologue?: string;
}): Promise<void> {
  const taskStore = getTaskStore(args.env);
  await taskStore.recordDecision({
    id: decisionId(args.task.id),
    taskId: args.task.id,
    employeeId: args.context.employee.identity.employeeId,
    verdict: args.verdict,
    reasoning: args.reasoning,
    internalMonologue: args.internalMonologue,
    evidenceTraceId: getEvidenceTraceId(args.context),
  });
}

async function createValidationResultArtifact(args: {
  env: OperatorAgentEnv;
  context: ResolvedEmployeeRunContext;
  task: Task;
  validationResult: ValidationResultArtifact;
}): Promise<string> {
  const taskStore = getTaskStore(args.env);
  const artifactId = validationResultArtifactId(args.task.id);

  await taskStore.createArtifact({
    id: artifactId,
    taskId: args.task.id,
    companyId: args.task.companyId,
    artifactType: "result",
    createdByEmployeeId: args.context.employee.identity.employeeId,
    summary: args.validationResult.summary,
    content: args.validationResult,
  });

  return artifactId;
}

async function createPublicRationaleArtifact(args: {
  env: OperatorAgentEnv;
  context: ResolvedEmployeeRunContext;
  task: Task;
  presentationStyle: EmployeePublicRationalePresentationStyle;
  summary: string;
  rationale: string;
  recommendedNextAction?: string;
}): Promise<string> {
  const taskStore = getTaskStore(args.env);
  const artifactId = publicRationaleArtifactId(args.task.id);

  await taskStore.createArtifact({
    id: artifactId,
    taskId: args.task.id,
    companyId: args.task.companyId,
    artifactType: "result",
    createdByEmployeeId: args.context.employee.identity.employeeId,
    summary: args.summary,
    content: {
      kind: "public_rationale",
      presentationStyle: args.presentationStyle,
      summary: args.summary,
      rationale: args.rationale,
      recommendedNextAction: args.recommendedNextAction,
    },
  });

  return artifactId;
}

// Sense-Think-Act: Thought Loop
async function processValidationTask(args: {
  env: OperatorAgentEnv;
  context: ResolvedEmployeeRunContext;
  task: Task;
  shouldClaim: boolean;
}): Promise<ValidationTaskDecision> {
  const taskStore = getTaskStore(args.env);

  if (args.shouldClaim && args.task.status !== "in_progress") {
    await taskStore.updateTaskStatus(args.task.id, "in_progress");
  }

  try {
    const targetUrl = requireTargetUrl(args.task);

    const healthCheck = await runHealthCheck({
      targetUrl,
      env: args.env,
      useControlPlaneBinding: shouldUseControlPlaneBinding(args.task),
    });

    const cognitionInput = await loadEmployeeCognitionInputForRun(
      args.context,
      args.env,
    );

    const cognition = await thinkWithinEmployeeBoundary(
      {
        ...cognitionInput,
        observations: [
          `Task ID: ${args.task.id}`,
          `Task type: ${args.task.taskType}`,
          `Task title: ${args.task.title}`,
          `Task payload: ${JSON.stringify(args.task.payload)}`,
          healthCheck.reasoning,
        ],
      },
      args.env,
    );

    const publicRationale = derivePublicRationale(cognition);

    const validationResult = toValidationResult({
      targetUrl,
      taskType: args.task.taskType,
      verdict: healthCheck.verdict,
      reasoning: healthCheck.reasoning,
      statusCode: healthCheck.statusCode,
    });

    await createValidationResultArtifact({
      env: args.env,
      context: args.context,
      task: args.task,
      validationResult,
    });

    const rationaleArtifactId = await createPublicRationaleArtifact({
      env: args.env,
      context: args.context,
      task: args.task,
      presentationStyle: publicRationale.presentationStyle,
      summary: publicRationale.summary,
      rationale: publicRationale.rationale,
      recommendedNextAction:
        publicRationale.recommendedNextAction
        ?? validationResult.recommendedNextAction,
    });

    await publishTaskRationaleToThread({
      env: args.env,
      companyId: args.task.companyId,
      taskId: args.task.id,
      artifactId: rationaleArtifactId,
      employeeId: args.context.employee.identity.employeeId,
      rationale: publicRationale,
    });

    await recordTaskDecision({
      env: args.env,
      context: args.context,
      task: args.task,
      verdict: healthCheck.verdict,
      reasoning: healthCheck.reasoning,
      internalMonologue: cognition.privateReasoning,
    });

    const decision: ValidationTaskDecision = {
      taskId: args.task.id,
      taskType: args.task.taskType,
      targetUrl,
      verdict: healthCheck.verdict,
      reasoning: healthCheck.reasoning,
      statusCode: healthCheck.statusCode,
      validationStatus: validationResult.status,
      recommendedNextAction: validationResult.recommendedNextAction,
    };

    logInfo("validation task processed", {
      employeeId: args.context.employee.identity.employeeId,
      taskId: args.task.id,
      verdict: decision.verdict,
      validationStatus: decision.validationStatus,
      targetUrl,
    });

    return decision;
  } catch (error) {
    const reasoning = error instanceof Error ? error.message : String(error);

    const validationResult = toValidationResult({
      taskType: args.task.taskType,
      verdict: "fail",
      reasoning,
    });

    await createValidationResultArtifact({
      env: args.env,
      context: args.context,
      task: args.task,
      validationResult,
    });

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
      validationStatus: validationResult.status,
      recommendedNextAction: validationResult.recommendedNextAction,
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

  const requestedTaskId = getRequestedTaskId(context);
  let tasks: Task[] = [];

  if (requestedTaskId || context.taskContext?.task) {
    tasks = await loadTasksForRun(env, context);
  } else {
    const loop = await selectNextEmployeeLoopAction(context, env);

    if (loop.action.type === "noop") {
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
        scanned: { tasks: loop.loadedContext.pendingTasks.length, eligibleTasks: 0 },
        decisions: [],
        summary: { processed: 0, passed: 0, failed: 0, remediations: 0, ignored: 0 },
        message: "No bounded loop action selected.",
      };
    }

    if (loop.action.type === "execute_task") {
      const { taskId } = loop.action;
      const task = loop.loadedContext.pendingTasks.find(
        (entry) => entry.id === taskId,
      );
      if (task) {
        tasks = [task];
      }
    }
  }

  const decisions: ValidationTaskDecision[] = [];

  for (const task of tasks) {
    if (task.taskType !== VALIDATION_TASK_TYPE) {
      if (requestedTaskId && task.id === requestedTaskId) {
        const reasoning = `Task ${task.id} uses unsupported taskType ${task.taskType}`;
        const validationResult = toValidationResult({
          taskType: task.taskType,
          verdict: "manual_escalation",
          reasoning,
        });

        await createValidationResultArtifact({
          env,
          context,
          task,
          validationResult,
        });

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
          validationStatus: validationResult.status,
          recommendedNextAction: validationResult.recommendedNextAction,
        });
      }
      continue;
    }

    decisions.push(
      await processValidationTask({
        env,
        context,
        task,
        shouldClaim: !requestedTaskId,
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