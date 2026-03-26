import type {
  EmployeeControlRecord,
  OperatorAgentEnv,
  ResolvedEmployeeControl,
} from "@aep/operator-agent/types";

function employeeControlKey(employeeId: string): string {
  return `employee-control:${employeeId}`;
}

function isBlockedState(state: EmployeeControlRecord["state"]): boolean {
  return state === "disabled_pending_review" || state === "disabled_by_manager";
}

function toResolvedControl(
  employeeId: string,
  control: EmployeeControlRecord | null
): ResolvedEmployeeControl {
  if (!control) {
    return {
      employeeId,
      state: "enabled",
      blocked: false,
      control: null,
    };
  }

  return {
    employeeId,
    state: control.state,
    blocked: isBlockedState(control.state),
    reviewAfter: control.reviewAfter,
    expiresAt: control.expiresAt,
    budgetOverride: control.budgetOverride,
    authorityOverride: control.authorityOverride,
    control,
  };
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

  async getEffective(
    employeeId: string,
    _nowIso: string
  ): Promise<ResolvedEmployeeControl> {
    const control = await this.get(employeeId);
    return toResolvedControl(employeeId, control);
  }

  isBlocked(control: EmployeeControlRecord | null): boolean {
    return control ? isBlockedState(control.state) : false;
  }
