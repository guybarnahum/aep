
import type { OperatorAgentEnv } from "@aep/operator-agent/types";
import type { D1Database } from "@cloudflare/workers-types";

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) throw new Error("Missing OPERATOR_AGENT_DB binding");
  return env.OPERATOR_AGENT_DB;
}

export class D1CooldownStore {
  private db: D1Database;
  private env: OperatorAgentEnv;
  private cooldownMs: number;

  constructor(env: OperatorAgentEnv, cooldownMs: number) {
    this.env = env;
    this.cooldownMs = cooldownMs;
    this.db = requireDb(env);
  }

  async isActive(jobId: string, nowMs: number): Promise<boolean> {
    const row = await this.db.prepare(
      `SELECT last_action_ms FROM job_cooldowns WHERE job_id = ?`
    ).bind(jobId).first<{ last_action_ms: number }>();
    if (!row) return false;
    const lastActionMs = Number(row.last_action_ms);
    if (!Number.isFinite(lastActionMs)) return false;
    return nowMs - lastActionMs < this.cooldownMs;
  }

  async mark(jobId: string, nowMs: number): Promise<void> {
    await this.db.prepare(
      `INSERT INTO job_cooldowns (job_id, last_action_ms)
       VALUES (?, ?)
       ON CONFLICT(job_id) DO UPDATE SET last_action_ms = excluded.last_action_ms`
    ).bind(jobId, nowMs).run();
  }
}
