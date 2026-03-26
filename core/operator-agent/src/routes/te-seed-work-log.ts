import { DecisionLog } from "@aep/operator-agent/lib/decision-log";
import type {
  AgentWorkLogEntry,
  OperatorAgentEnv,
  TimeoutRecoveryResult,
} from "@aep/operator-agent/types";
import type { ExecutionContext } from "@aep/operator-agent/types/execution-provenance";

type SeedWorkLogBody = {
  employeeId: string;
  result: TimeoutRecoveryResult;
  count?: number;
  executionContext?: ExecutionContext;
};

export async function handleSeedWorkLog(
  request: Request,
  env?: OperatorAgentEnv
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: SeedWorkLogBody;
  try {
    body = (await request.json()) as SeedWorkLogBody;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.employeeId || typeof body.employeeId !== "string") {
    return Response.json(
      { ok: false, error: "Missing required field: employeeId" },
      { status: 400 }
    );
  }

  if (!body.result || typeof body.result !== "string") {
    return Response.json(
      { ok: false, error: "Missing required field: result" },
      { status: 400 }
    );
  }

  const count = Math.min(Math.max(1, body.count ?? 1), 20);
  const log = new DecisionLog(env ?? {});
  const nowMs = Date.now();

  for (let i = 0; i < count; i++) {
    const ts = new Date(nowMs + i).toISOString();
    const entry: AgentWorkLogEntry = {
      timestamp: ts,
      employeeId: body.employeeId,
      employeeName: "Seeded Test Entry",
      departmentId: "aep-infra-ops",
      roleId: "timeout-recovery-operator",
      policyVersion: "commit10-stageD",
      trigger: "manual",
      runId: `seed-run-${nowMs}-${i}`,
      jobId: `seed-job-${nowMs}-${i}`,
      tenant: "dev",
      service: "control-plane",
      action: "advance-timeout",
      mode: "apply",
      eligible: true,
      reason: "eligible_timeout_recovery",
      result: body.result,
      budgetSnapshot: {
        actionsUsedThisScan: 1,
        actionsUsedThisHour: 1,
        tenantActionsUsedThisHour: 1,
      },
      errorMessage:
        body.result === "operator_action_failed"
          ? "Seeded test failure"
          : undefined,
      executionContext: body.executionContext,
    };
    await log.write(entry);
  }

  return Response.json({ ok: true, seeded: count });
}
