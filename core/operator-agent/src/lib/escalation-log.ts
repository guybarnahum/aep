import type { EscalationRecord, OperatorAgentEnv } from "@aep/operator-agent/types";

function escalationKey(escalationId: string): string {
  return `escalation:${escalationId}`;
}

function escalationListPrefix(): string {
  return "escalation:";
}

function compareDescendingByTimestamp(
  a: EscalationRecord,
  b: EscalationRecord
): number {
  return b.timestamp.localeCompare(a.timestamp);
}

export class EscalationLog {
  constructor(private readonly env: OperatorAgentEnv) {}

  async write(record: EscalationRecord): Promise<void> {
    await this.env.OPERATOR_AGENT_KV?.put(
      escalationKey(record.escalationId),
      JSON.stringify(record),
      {
        expirationTtl: 60 * 60 * 24 * 30,
      }
    );
  }

  async list(limit: number): Promise<EscalationRecord[]> {
    const list = await this.env.OPERATOR_AGENT_KV?.list({
      prefix: escalationListPrefix(),
      limit,
    });

    const entries: EscalationRecord[] = [];

    for (const key of list?.keys ?? []) {
      const raw = await this.env.OPERATOR_AGENT_KV?.get(key.name);
      if (!raw) {
        continue;
      }

      try {
        entries.push(JSON.parse(raw) as EscalationRecord);
      } catch {
        // ignore malformed entries
      }
    }

    entries.sort(compareDescendingByTimestamp);
    return entries;
  }
}
