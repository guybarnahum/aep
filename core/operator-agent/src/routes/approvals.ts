import { createStores } from "@aep/operator-agent/lib/store-factory";
import type {
  ApprovalStatus,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

const VALID_APPROVAL_STATUSES: ApprovalStatus[] = [
  "pending",
  "approved",
  "rejected",
  "expired",
];

export async function handleApprovals(
  request: Request,
  env?: OperatorAgentEnv
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = Math.max(
    1,
    Math.min(100, limitParam ? Number(limitParam) || 20 : 20)
  );

  const statusParam = url.searchParams.get("status") as ApprovalStatus | null;
  const status =
    statusParam && VALID_APPROVAL_STATUSES.includes(statusParam)
      ? statusParam
      : undefined;

  const employeeId = url.searchParams.get("employeeId") ?? undefined;
  const companyId = url.searchParams.get("companyId") ?? undefined;

  const store = createStores(env ?? {}).approvals;
  const entries = await store.list({
    limit,
    status,
    employeeId,
    companyId,
  });

  return Response.json({
    ok: true,
    count: entries.length,
    entries,
  });
}