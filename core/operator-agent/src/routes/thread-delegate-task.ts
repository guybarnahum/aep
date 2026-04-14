import {
  appendDashboardActionMessage,
  appendSystemMessage,
} from "@aep/operator-agent/lib/human-interaction-threads";
import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import {
  TaskDependencyValidationError,
  type EmployeeMessage,
} from "@aep/operator-agent/lib/store-types";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

type DelegateTaskFromThreadRequest = {
  companyId?: string;
  originatingTeamId?: string;
  assignedTeamId?: string;
  ownerEmployeeId?: string;
  assignedEmployeeId?: string;
  createdByEmployeeId?: string;
  taskType?: string;
  title?: string;
  payload?: Record<string, unknown>;
  dependsOnTaskIds?: string[];
  sourceMessageId?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function parseBody(
  request: Request,
): Promise<DelegateTaskFromThreadRequest | Response> {
  try {
    return (await request.json()) as DelegateTaskFromThreadRequest;
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }
}

function validateDependsOnTaskIds(
  value: unknown,
): string[] | Response {
  if (typeof value === "undefined") {
    return [];
  }

  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    return Response.json(
      { ok: false, error: "dependsOnTaskIds must be an array of strings" },
      { status: 400 },
    );
  }

  return value;
}

function getDelegationProvenance(args: {
  threadRelatedApprovalId?: string;
  threadRelatedEscalationId?: string;
  message: EmployeeMessage;
}): {
  sourceApprovalId?: string;
  sourceEscalationId?: string;
} {
  return {
    sourceApprovalId:
      args.threadRelatedApprovalId ?? args.message.relatedApprovalId ?? undefined,
    sourceEscalationId:
      args.threadRelatedEscalationId ?? args.message.relatedEscalationId ?? undefined,
  };
}

function isDelegationEligible(args: {
  message: EmployeeMessage;
  sourceApprovalId?: string;
  sourceEscalationId?: string;
}): boolean {
  return Boolean(
    args.message.responseActionType
      && args.message.responseActionStatus === "applied"
      && (args.sourceApprovalId || args.sourceEscalationId),
  );
}

export async function handleDelegateTaskFromThread(
  request: Request,
  env?: OperatorAgentEnv,
  threadId?: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env || !threadId) {
    return Response.json(
      { ok: false, error: "Missing operator-agent environment or threadId" },
      { status: 500 },
    );
  }

  const body = await parseBody(request);
  if (body instanceof Response) {
    return body;
  }

  if (
    !body.originatingTeamId
    || !body.assignedTeamId
    || !body.taskType
    || !body.title
    || !body.sourceMessageId
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "originatingTeamId, assignedTeamId, taskType, title, and sourceMessageId are required",
      },
      { status: 400 },
    );
  }

  const dependsOnTaskIds = validateDependsOnTaskIds(body.dependsOnTaskIds);
  if (dependsOnTaskIds instanceof Response) {
    return dependsOnTaskIds;
  }

  const taskStore = getTaskStore(env);
  const thread = await taskStore.getMessageThread(threadId);

  if (!thread) {
    return Response.json({ ok: false, error: "Thread not found" }, { status: 404 });
  }

  if (body.companyId && body.companyId !== thread.companyId) {
    return Response.json(
      { ok: false, error: "companyId does not match thread company" },
      { status: 400 },
    );
  }

  const sourceMessage = await taskStore.getMessage(body.sourceMessageId);

  if (!sourceMessage) {
    return Response.json({ ok: false, error: "Source message not found" }, { status: 404 });
  }

  if (sourceMessage.threadId !== thread.id) {
    return Response.json(
      { ok: false, error: "Source message does not belong to thread" },
      { status: 400 },
    );
  }

  if (sourceMessage.companyId !== thread.companyId) {
    return Response.json(
      { ok: false, error: "Thread and source message company mismatch" },
      { status: 400 },
    );
  }

  const { sourceApprovalId, sourceEscalationId } = getDelegationProvenance({
    threadRelatedApprovalId: thread.relatedApprovalId,
    threadRelatedEscalationId: thread.relatedEscalationId,
    message: sourceMessage,
  });

  if (
    !isDelegationEligible({
      message: sourceMessage,
      sourceApprovalId,
      sourceEscalationId,
    })
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "Source message is not an applied approval/escalation thread action and cannot delegate a task",
      },
      { status: 400 },
    );
  }

  const companyId = body.companyId ?? thread.companyId ?? "company_internal_aep";
  const taskId = `task_${crypto.randomUUID().split("-")[0]}`;

  try {
    await taskStore.createTaskWithDependencies({
      task: {
        id: taskId,
        companyId,
        originatingTeamId: body.originatingTeamId,
        assignedTeamId: body.assignedTeamId,
        ownerEmployeeId: body.ownerEmployeeId,
        assignedEmployeeId: body.assignedEmployeeId,
        createdByEmployeeId: body.createdByEmployeeId,
        taskType: body.taskType,
        title: body.title,
        payload: asRecord(body.payload),
        sourceThreadId: thread.id,
        sourceMessageId: sourceMessage.id,
        sourceApprovalId,
        sourceEscalationId,
      },
      dependsOnTaskIds,
    });
  } catch (error) {
    if (error instanceof TaskDependencyValidationError) {
      return Response.json(
        {
          ok: false,
          error: error.message,
          code: error.code,
          details: error.details ?? null,
        },
        { status: 400 },
      );
    }
    throw error;
  }

  const actor = body.createdByEmployeeId ?? "operator";
  const assignmentSummary = body.assignedEmployeeId
    ? `assigned to ${body.assignedEmployeeId}`
    : `assigned to team ${body.assignedTeamId}`;

  const delegationMessageId = await appendDashboardActionMessage({
    env,
    threadId,
    companyId,
    senderEmployeeId: actor,
    subject: "Follow-up task delegated",
    body: `Delegated follow-up task ${taskId} (${body.title}) from source message ${sourceMessage.id}; ${assignmentSummary}.`,
    type: "task",
    responseActionType: "delegate_task",
    responseActionStatus: "applied",
    causedStateTransition: false,
    relatedTaskId: taskId,
    relatedApprovalId: sourceApprovalId,
    relatedEscalationId: sourceEscalationId,
  });

  await appendSystemMessage({
    env,
    threadId,
    companyId,
    senderEmployeeId: actor,
    subject: "Follow-up task delegated",
    body: `Created follow-up task ${taskId} (${body.title}) from thread outcome; ${assignmentSummary}.`,
    type: "task",
    relatedTaskId: taskId,
    relatedApprovalId: sourceApprovalId,
    relatedEscalationId: sourceEscalationId,
  });

  return Response.json(
    {
      ok: true,
      taskId,
      threadId,
      sourceMessageId: sourceMessage.id,
      delegationMessageId,
    },
    { status: 201 },
  );
}