import type { OperatorAgentEnv } from "../types";

function cooldownKey(jobId: string): string {
  return `cooldown:job:${jobId}`;
}

export class CooldownStore {
  constructor(
    private readonly env: OperatorAgentEnv,
    private readonly cooldownMs: number
  ) {}

  async isActive(jobId: string, nowMs: number): Promise<boolean> {
    const raw = await this.env.OPERATOR_AGENT_KV?.get(cooldownKey(jobId));
    if (!raw) return false;

    const lastActionMs = Number(raw);
    if (!Number.isFinite(lastActionMs)) return false;

    return nowMs - lastActionMs < this.cooldownMs;
  }

  async mark(jobId: string, nowMs: number): Promise<void> {
    const ttlSeconds = Math.max(60, Math.ceil(this.cooldownMs / 1000) * 2);

    await this.env.OPERATOR_AGENT_KV?.put(cooldownKey(jobId), String(nowMs), {
      expirationTtl: ttlSeconds,
    });
  }
}
