import { TEAM_INFRA } from "@aep/operator-agent/org/teams";
import { createStores } from "@aep/operator-agent/lib/store-factory";
import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type {
  AgentRoleId,
  ApprovalRecord,
  ApprovalSource,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";
import type { ExecutionContext } from "@aep/operator-agent/types/execution-provenance";

type SeedApprovalBody = {
  requestedByEmployeeId?: string;
  requestedByEmployeeName?: string;
  requestedByRoleId?: AgentRoleId;
  actionType?: string;
  reason?: string;
  message?: string;
  companyId?: string;
  taskId?: string;
  heartbeatId?: string;
  payload?: Record<string, unknown>;
  source?: ApprovalSource;
  executionContext?: ExecutionContext;
  createThread?: boolean;
  threadTopic?: string;
  threadReceiverEmployeeId?: string;
};

const VALID_SOURCES: ApprovalSource[] = ["manager", "policy", "system"];
const VALID_ROLE_IDS: AgentRoleId[] = [
  "timeout-recovery-operator",
  "infra-ops-manager",
  "retry-supervisor",
  "teardown-safety-operator",
  "incident-triage-operator",
];

export async function handleSeedApproval(
  request: Request,
  env: OperatorAgentEnv
): Promise<Response> {
  if (env.ENABLE_TEST_ENDPOINTS !== "true") {
    return new Response("Not Found", { status: 404 });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: SeedApprovalBody;
  try {
    body = (await request.json()) as SeedApprovalBody;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.requestedByEmployeeId || typeof body.requestedByEmployeeId !== "string") {
    return Response.json(
      { ok: false, error: "Missing required field: requestedByEmployeeId" },
      { status: 400 }
    );
  }

  if (!body.requestedByRoleId || !VALID_ROLE_IDS.includes(body.requestedByRoleId)) {
    return Response.json(
      { ok: false, error: "Missing or invalid required field: requestedByRoleId" },
      { status: 400 }
    );
  }

  if (!body.actionType || typeof body.actionType !== "string") {
    return Response.json(
      { ok: false, error: "Missing required field: actionType" },
      { status: 400 }
    );
  }

  if (!body.reason || typeof body.reason !== "string") {
    return Response.json(
      { ok: false, error: "Missing required field: reason" },
      { status: 400 }
    );
  }

  if (!body.message || typeof body.message !== "string") {
    return Response.json(
      { ok: false, error: "Missing required field: message" },
      { status: 400 }
    );
  }

  const source: ApprovalSource =
    body.source && VALID_SOURCES.includes(body.source)
      ? body.source
      : "manager";

  const approval: ApprovalRecord = {
    approvalId: `approval-${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    companyId: body.companyId,
    taskId: body.taskId,
    heartbeatId: body.heartbeatId,
    teamId: TEAM_INFRA,
    requestedByEmployeeId: body.requestedByEmployeeId,
    requestedByEmployeeName: body.requestedByEmployeeName,
    requestedByRoleId: body.requestedByRoleId,
    source,
    actionType: body.actionType,
    payload: body.payload ?? {},
    status: "pending",
    reason: body.reason,
    message: body.message,
    executionContext: body.executionContext,
  };

  const store = createStores(env).approvals;
  await store.write(approval);

  let threadId: string | undefined;

  if (body.createThread === true) {
    const taskStore = getTaskStore(env);
    threadId = `thr_${crypto.randomUUID().split("-")[0]}`;

    await taskStore.createMessageThread({
      id: threadId,
      companyId: body.companyId ?? "company_internal_aep",
      topic: body.threadTopic ?? `Approval ${approval.approvalId}`,
      createdByEmployeeId: body.requestedByEmployeeId,
      relatedTaskId: body.taskId,
      relatedApprovalId: approval.approvalId,
      visibility: "internal",
    });

    await taskStore.createMessage({
      id: `msg_${crypto.randomUUID().split("-")[0]}`,
      threadId,
      companyId: body.companyId ?? "company_internal_aep",
      senderEmployeeId: body.requestedByEmployeeId,
      receiverEmployeeId: body.threadReceiverEmployeeId ?? body.requestedByEmployeeId,
      type: "coordination",
      status: "pending",
      source: "system",
      subject: "Approval requested",
      body: body.message,
      payload: {},
      requiresResponse: true,
      responseActionType: "approve_approval",
      responseActionStatus: "requested",
      causedStateTransition: false,
      relatedTaskId: body.taskId,
      relatedApprovalId: approval.approvalId,
    });
  }

  return Response.json({
    ok: true,
    approval,
    threadId,
  });
}