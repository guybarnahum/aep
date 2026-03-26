import type { AgentBudget, BudgetSnapshot, OperatorAgentEnv } from "../types";

function hourBucket(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 13);
}

function employeeHourlyKey(employeeId: string, nowMs: number): string {
  return `budget:employee:${employeeId}:hour:${hourBucket(nowMs)}`;
}

function tenantHourlyKey(
  employeeId: string,
  tenant: string,
  nowMs: number
): string {
  return `budget:employee:${employeeId}:tenant:${tenant}:hour:${hourBucket(nowMs)}`;
}

async function readCounter(env: OperatorAgentEnv, key: string): Promise<number> {
  const raw = await env.OPERATOR_AGENT_KV?.get(key);
  if (!raw) return 0;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function writeCounter(
  env: OperatorAgentEnv,
  key: string,
  value: number
): Promise<void> {
  await env.OPERATOR_AGENT_KV?.put(key, String(value), {
    expirationTtl: 60 * 60 * 2,
  });
}

export class BudgetEnforcer {
  constructor(
    private readonly env: OperatorAgentEnv,
    private readonly employeeId: string,
    private readonly budget: AgentBudget
  ) {}

  async getSnapshot(args: {
    tenant?: string;
    actionsUsedThisScan: number;
    nowMs: number;
  }): Promise<BudgetSnapshot> {
    const actionsUsedThisHour = await readCounter(
      this.env,
      employeeHourlyKey(this.employeeId, args.nowMs)
    );

    const tenantActionsUsedThisHour =
      args.tenant == null
        ? 0
        : await readCounter(
            this.env,
            tenantHourlyKey(this.employeeId, args.tenant, args.nowMs)
          );

    return {
      actionsUsedThisScan: args.actionsUsedThisScan,
      actionsUsedThisHour,
      tenantActionsUsedThisHour,
    };
  }

  async check(args: {
    tenant?: string;
    actionsUsedThisScan: number;
    nowMs: number;
  }): Promise<
    | { allowed: true; snapshot: BudgetSnapshot }
    | {
        allowed: false;
        reason:
          | "skipped_budget_scan_exhausted"
          | "skipped_budget_hourly_exhausted"
          | "skipped_budget_tenant_hourly_exhausted";
        snapshot: BudgetSnapshot;
      }
  > {
    const snapshot = await this.getSnapshot(args);

    if (snapshot.actionsUsedThisScan >= this.budget.maxActionsPerScan) {
      return {
        allowed: false,
        reason: "skipped_budget_scan_exhausted",
        snapshot,
      };
    }

    if (snapshot.actionsUsedThisHour >= this.budget.maxActionsPerHour) {
      return {
        allowed: false,
        reason: "skipped_budget_hourly_exhausted",
        snapshot,
      };
    }

    if (
      args.tenant &&
      snapshot.tenantActionsUsedThisHour >=
        this.budget.maxActionsPerTenantPerHour
    ) {
      return {
        allowed: false,
        reason: "skipped_budget_tenant_hourly_exhausted",
        snapshot,
      };
    }

    return {
      allowed: true,
      snapshot,
    };
  }

  async recordAction(args: { tenant?: string; nowMs: number }): Promise<void> {
    const employeeKey = employeeHourlyKey(this.employeeId, args.nowMs);
    const currentEmployee = await readCounter(this.env, employeeKey);
    await writeCounter(this.env, employeeKey, currentEmployee + 1);

    if (args.tenant) {
      const tenantKey = tenantHourlyKey(this.employeeId, args.tenant, args.nowMs);
      const currentTenant = await readCounter(this.env, tenantKey);
      await writeCounter(this.env, tenantKey, currentTenant + 1);
    }
  }
}
