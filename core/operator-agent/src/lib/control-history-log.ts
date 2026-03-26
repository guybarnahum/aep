import type {
  EmployeeControlHistoryRecord,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

function controlHistoryPrefix(employeeId?: string): string {
  return employeeId
    ? `employee-control-history:${employeeId}:`
    : "employee-control-history:";
}

function compareDescendingByTimestamp(
  a: EmployeeControlHistoryRecord,
  b: EmployeeControlHistoryRecord
): number {
  return b.timestamp.localeCompare(a.timestamp);
}

export class EmployeeControlHistoryLog {
  constructor(private readonly env: OperatorAgentEnv) {}

  async write(record: EmployeeControlHistoryRecord): Promise<void> {
    const key = `employee-control-history:${record.employeeId}:${record.historyId}`;

    await this.env.OPERATOR_AGENT_KV?.put(key, JSON.stringify(record), {
      expirationTtl: 60 * 60 * 24 * 30,
    });
  }

  async list(args: {
    employeeId?: string;
    limit: number;
  }): Promise<EmployeeControlHistoryRecord[]> {
    const list = await this.env.OPERATOR_AGENT_KV?.list({
      prefix: controlHistoryPrefix(args.employeeId),
      limit: args.limit,
    });

    const entries: EmployeeControlHistoryRecord[] = [];

    for (const key of list?.keys ?? []) {
      const raw = await this.env.OPERATOR_AGENT_KV?.get(key.name);
      if (!raw) {
        continue;
      }

      try {
        entries.push(JSON.parse(raw) as EmployeeControlHistoryRecord);
      } catch {
        // ignore malformed entries
      }
    }

    entries.sort(compareDescendingByTimestamp);
    return entries;
  }
}
