import type {
  EmployeeControlRecord,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

function employeeControlKey(employeeId: string): string {
  return `employee-control:${employeeId}`;
}

export class EmployeeControlStore {
  constructor(private readonly env: OperatorAgentEnv) {}

  async get(employeeId: string): Promise<EmployeeControlRecord | null> {
    const raw = await this.env.OPERATOR_AGENT_KV?.get(employeeControlKey(employeeId));
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as EmployeeControlRecord;
    } catch {
      return null;
    }
  }

  async put(record: EmployeeControlRecord): Promise<void> {
    await this.env.OPERATOR_AGENT_KV?.put(
      employeeControlKey(record.employeeId),
      JSON.stringify(record),
      {
        expirationTtl: 60 * 60 * 24 * 14,
      }
    );
  }

  async clear(employeeId: string): Promise<void> {
    await this.env.OPERATOR_AGENT_KV?.delete(employeeControlKey(employeeId));
  }
}
