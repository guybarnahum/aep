import type { EscalationRecord, EscalationState, OperatorAgentEnv } from "@aep/operator-agent/types";

function escalationKey(escalationId: string): string {
  return `escalation:${escalationId}`;
}

function escalationListPrefix(): string {
  return "escalation:";
}

function normalizeEscalation(raw: Partial<EscalationRecord>): EscalationRecord {
  return {
    ...(raw as EscalationRecord),
    state: raw.state ?? "open",
  };
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

  async get(escalationId: string): Promise<EscalationRecord | null> {
    const raw = await this.env.OPERATOR_AGENT_KV?.get(
      escalationKey(escalationId)
    );
    if (!raw) return null;
    try {
      return normalizeEscalation(JSON.parse(raw) as Partial<EscalationRecord>);
    } catch {
      return null;
    }
  }

  async put(record: EscalationRecord): Promise<void> {
    await this.env.OPERATOR_AGENT_KV?.put(
      escalationKey(record.escalationId),
      JSON.stringify(record),
      {
        expirationTtl: 60 * 60 * 24 * 30,
      }
    );
  }

  async list(limit: number, stateFilter?: EscalationState): Promise<EscalationRecord[]> {
    const list = await this.env.OPERATOR_AGENT_KV?.list({
      prefix: escalationListPrefix(),
      limit: stateFilter ? 100 : limit,
    });

    const entries: EscalationRecord[] = [];

    for (const key of list?.keys ?? []) {
      const raw = await this.env.OPERATOR_AGENT_KV?.get(key.name);
      if (!raw) {
        continue;
      }

      try {
        entries.push(normalizeEscalation(JSON.parse(raw) as Partial<EscalationRecord>));
      } catch {
        // ignore malformed entries
      }
    }

    entries.sort(compareDescendingByTimestamp);

    if (stateFilter) {
      return entries.filter((e) => e.state === stateFilter).slice(0, limit);
    }

    return entries;
  }
}
