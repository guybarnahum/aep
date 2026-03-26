import type {
  ApprovalRecord,
  ApprovalStatus,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

function approvalKey(approvalId: string): string {
  return `approval:${approvalId}`;
}

function approvalListPrefix(): string {
  return "approval:";
}

function normalizeApproval(raw: Partial<ApprovalRecord>): ApprovalRecord {
  return {
    ...(raw as ApprovalRecord),
    status: raw.status ?? "pending",
  };
}

function compareDescendingByTimestamp(
  a: ApprovalRecord,
  b: ApprovalRecord
): number {
  return b.timestamp.localeCompare(a.timestamp);
}

export class ApprovalStore {
  constructor(private readonly env: OperatorAgentEnv) {}

  async write(record: ApprovalRecord): Promise<void> {
    await this.env.OPERATOR_AGENT_KV?.put(
      approvalKey(record.approvalId),
      JSON.stringify(record),
      {
        expirationTtl: 60 * 60 * 24 * 30,
      }
    );
  }

  async get(approvalId: string): Promise<ApprovalRecord | null> {
    const raw = await this.env.OPERATOR_AGENT_KV?.get(approvalKey(approvalId));
    if (!raw) return null;
    try {
      return normalizeApproval(JSON.parse(raw) as Partial<ApprovalRecord>);
    } catch {
      return null;
    }
  }

  async put(record: ApprovalRecord): Promise<void> {
    await this.write(record);
  }

  async list(args: {
    limit: number;
    status?: ApprovalStatus;
    employeeId?: string;
    companyId?: string;
  }): Promise<ApprovalRecord[]> {
    const list = await this.env.OPERATOR_AGENT_KV?.list({
      prefix: approvalListPrefix(),
      limit: 100,
    });

    const entries: ApprovalRecord[] = [];

    for (const key of list?.keys ?? []) {
      const raw = await this.env.OPERATOR_AGENT_KV?.get(key.name);
      if (!raw) continue;

      try {
        entries.push(
          normalizeApproval(JSON.parse(raw) as Partial<ApprovalRecord>)
        );
      } catch {
        // ignore malformed entries
      }
    }

    entries.sort(compareDescendingByTimestamp);

    return entries
      .filter((entry) =>
        args.status ? entry.status === args.status : true
      )
      .filter((entry) =>
        args.employeeId ? entry.requestedByEmployeeId === args.employeeId : true
      )
      .filter((entry) =>
        args.companyId ? entry.companyId === args.companyId : true
      )
      .slice(0, args.limit);
  }
}