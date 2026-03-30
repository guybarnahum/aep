import { createStores } from "@aep/operator-agent/lib/store-factory";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export async function handleApproveApproval(
  request: Request,
  env?: OperatorAgentEnv
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  const record = asRecord(body);
  const approvalId =
    typeof record.approvalId === "string" && record.approvalId.trim() !== ""
      ? record.approvalId
      : null;

  if (!approvalId) {
    return Response.json(
      { ok: false, error: "Missing required field: approvalId" },
      { status: 400 }
    );
  }

  const decidedBy =
    typeof record.decidedBy === "string" && record.decidedBy.trim() !== ""
      ? record.decidedBy
      : "operator";

  const decisionNote =
    typeof record.decisionNote === "string" && record.decisionNote.trim() !== ""
      ? record.decisionNote
      : undefined;

  const store = createStores(env ?? {}).approvals;
  const result = await store.decide({
    approvalId,
    nextStatus: "approved",
    decidedBy,
    decisionNote,
  });

  if (!result.ok && result.reason === "not_found") {
    return Response.json({ ok: false, error: "Approval not found" }, { status: 404 });
  }

  if (!result.ok && result.reason === "already_decided") {
    return Response.json(
      {
        ok: false,
        error: "Approval is no longer pending",
        approval: result.approval,
      },
      { status: 409 }
    );
  }

  return Response.json({
    ok: true,
    approval: result.approval,
  });
}