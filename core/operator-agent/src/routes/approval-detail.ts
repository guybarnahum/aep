import { ApprovalStore } from "@aep/operator-agent/lib/approval-store";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleApprovalDetail(
  request: Request,
  env: OperatorAgentEnv,
  approvalId: string
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const store = new ApprovalStore(env);
  const approval = await store.get(approvalId);

  if (!approval) {
    return Response.json(
      { ok: false, error: "Approval not found" },
      { status: 404 }
    );
  }

  return Response.json({
    ok: true,
    approval,
  });
}