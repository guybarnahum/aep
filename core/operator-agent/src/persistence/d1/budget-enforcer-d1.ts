
import type { AgentBudget, BudgetSnapshot, OperatorAgentEnv } from "@aep/operator-agent/types";
import type { D1Database } from "@cloudflare/workers-types";

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) throw new Error("Missing OPERATOR_AGENT_DB binding");
  return env.OPERATOR_AGENT_DB;
}

function hourBucket(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 13);
}

export class D1BudgetEnforcer {
  private db: D1Database;
  private env: OperatorAgentEnv;
  private employeeId: string;
  private budget: AgentBudget;

  constructor(env: OperatorAgentEnv, employeeId: string, budget: AgentBudget) {
    this.env = env;
    this.employeeId = employeeId;
    this.budget = budget;
    this.db = requireDb(env);
  }

  async getCounter(tenant: string | undefined, nowMs: number): Promise<number> {
    const bucket = hourBucket(nowMs);
    const stmt = this.db.prepare(
      `SELECT count FROM employee_budget_counters WHERE employee_id = ? AND tenant IS ? AND hour_bucket = ?`
    );
    const row = await stmt.bind(this.employeeId, tenant ?? null, bucket).first<{ count: number }>();
    return row?.count ?? 0;
  }

  async setCounter(tenant: string | undefined, nowMs: number, value: number): Promise<void> {
    const bucket = hourBucket(nowMs);
    await this.db.prepare(
      `INSERT INTO employee_budget_counters (employee_id, tenant, hour_bucket, count)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(employee_id, tenant, hour_bucket) DO UPDATE SET count = excluded.count`
    ).bind(this.employeeId, tenant ?? null, bucket, value).run();
  }

  async getSnapshot(args: {
    tenant?: string;
    actionsUsedThisScan: number;
    nowMs: number;
  }): Promise<BudgetSnapshot> {
    const actionsUsedThisHour = await this.getCounter(undefined, args.nowMs);
    const tenantActionsUsedThisHour = args.tenant
      ? await this.getCounter(args.tenant, args.nowMs)
      : 0;
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
    // Increment employee counter
    const now = args.nowMs;
    const currentEmployee = await this.getCounter(undefined, now);
    await this.setCounter(undefined, now, currentEmployee + 1);
    if (args.tenant) {
      const currentTenant = await this.getCounter(args.tenant, now);
      await this.setCounter(args.tenant, now, currentTenant + 1);
    }
  }
}
