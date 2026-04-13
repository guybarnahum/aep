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

// Deliberation Helper: Generates the internal monologue (Thinking Trace)
async function deliberate(args: {
  context: ResolvedEmployeeRunContext;
  task: Task;
  observation: string;
}): Promise<string> {
  const { employee } = args.context;
  const displayName = employee.identity.employeeName ?? employee.identity.employeeId;
  const bio = employee.identity.bio || "No bio set.";
  const tone = employee.identity.tone || "Professional";
  const skills = Array.isArray(employee.identity.skills) && employee.identity.skills.length > 0
    ? employee.identity.skills.join(", ")
    : "Generalist";
  const persona = `Name: ${displayName}\nRole: ${employee.identity.roleId}\nBio: ${bio}\nTone: ${tone}\nSkills: ${skills}`;

  const prompt = `
[SYSTEM: COGNITIVE IDENTITY]
${persona}

[STRATEGIC CONTEXT]
Roadmap: Platform Stability 1.0
Objective: Ensure 99.9% uptime for preview deployments.

[OBSERVATION]
I am validating Task: ${args.task.id} (${args.task.taskType}).
Current Observation: ${args.observation}

[TASK]
Generate a 1-2 sentence internal monologue (Thinking Trace) about how you interpret this result relative to your goals. \nWrite in your specific persona tone. Do not use filler.
`;

  // Placeholder for LLM call. In Cloudflare: return await env.AI.run(...)
  // For now, we simulate the "Thought" if AI isn't bound, or use a simple heuristic.
  return `Observed ${args.observation}. As an SRE, I must ensure this doesn't degrade the core substrate. Verdict is determined by my strict reliability threshold.`;
}

// Updated recordTaskDecision to accept internalMonologue
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

    // SENSE: Run the health check
    const healthCheck = await runHealthCheck({
      targetUrl,
      env: args.env,
      useControlPlaneBinding: shouldUseControlPlaneBinding(args.task),
    });

    // THINK: Generate the Internal Monologue
    const internalMonologue = await deliberate({
      context: args.context,
      task: args.task,
      observation: healthCheck.reasoning,
    });

    // ACT: Record Decision with Thought Trace
    await recordTaskDecision({
      env: args.env,
      context: args.context,
      task: args.task,
      verdict: healthCheck.verdict,
      reasoning: healthCheck.reasoning,
      internalMonologue,
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
  const requestedTaskId = getRequestedTaskId(context);
  const decisions: ValidationTaskDecision[] = [];

  for (const task of tasks) {
    if (task.taskType !== VALIDATION_TASK_TYPE) {
      if (requestedTaskId && task.id === requestedTaskId) {
        const reasoning = `Task ${task.id} uses unsupported taskType ${task.taskType}`;
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