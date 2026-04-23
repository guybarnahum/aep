import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveRuntimeEmployeeByRole,
} from "./runtime-employee-resolver-d1";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

type FakeRuntimeEmployeeRow = {
  employee_id: string;
  employee_name: string;
  company_id: string;
  team_id: string;
  role_id: string;
  manager_role_id?: string | null;
  created_at?: string;
  is_synthetic?: number | string | null;
};

type FakeRuntimeRolePolicyRow = {
  role_id: string;
  authority_json: string;
  budget_json: string;
  escalation_json: string;
};

class FakePreparedStatement {
  private boundArgs: unknown[] = [];

  constructor(
    private readonly db: FakeD1Database,
    private readonly sql: string,
  ) {}

  bind(...args: unknown[]): FakePreparedStatement {
    this.boundArgs = args;
    return this;
  }

  async first<T>(): Promise<T | null> {
    return (this.db.execute(this.sql, this.boundArgs, "first") as T | null) ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: (this.db.execute(this.sql, this.boundArgs, "all") as T[]) ?? [] };
  }
}

class FakeD1Database {
  constructor(
    private readonly runtimeEmployees: FakeRuntimeEmployeeRow[],
    private readonly runtimeRolePolicies: FakeRuntimeRolePolicyRow[],
  ) {}

  prepare(sql: string): FakePreparedStatement {
    return new FakePreparedStatement(this, sql);
  }

  execute(sql: string, args: unknown[], mode: "first" | "all"): unknown {
    const normalized = sql.replace(/\s+/g, " ").trim();

    if (
      normalized.includes("FROM runtime_role_policies") &&
      normalized.includes("WHERE role_id = ?")
    ) {
      const roleId = String(args[0]);
      const row = this.runtimeRolePolicies.find((entry) => entry.role_id === roleId);
      return row ? { ...row } : null;
    }

    if (
      normalized.includes("FROM runtime_role_policies") &&
      normalized.includes("ORDER BY role_id")
    ) {
      return this.runtimeRolePolicies
        .slice()
        .sort((left, right) => left.role_id.localeCompare(right.role_id))
        .map((row) => ({ ...row }));
    }

    if (
      normalized.includes("FROM employees_catalog e") &&
      normalized.includes("INNER JOIN roles_catalog r") &&
      normalized.includes("e.role_id = ?")
    ) {
      const roleId = String(args[0]);
      const companyId = args.length > 1 ? String(args[1]) : undefined;
      const teamId = args.length > 2 ? String(args[2]) : undefined;

      const row = this.runtimeEmployees.find((employee) => {
        return (
          employee.role_id === roleId &&
          (companyId ? employee.company_id === companyId : true) &&
          (teamId ? employee.team_id === teamId : true)
        );
      });

      return row ? { ...row } : null;
    }

    throw new Error(`Unhandled fake D1 SQL: ${normalized} [mode=${mode}]`);
  }
}

function createEnv(args?: {
  runtimeEmployees?: FakeRuntimeEmployeeRow[];
  runtimeRolePolicies?: FakeRuntimeRolePolicyRow[];
}): OperatorAgentEnv {
  const runtimeEmployees = args?.runtimeEmployees ?? [];
  const runtimeRolePolicies = args?.runtimeRolePolicies ?? [];

  return {
    OPERATOR_AGENT_DB: new FakeD1Database(
      runtimeEmployees,
      runtimeRolePolicies,
    ) as unknown as D1Database,
  } as OperatorAgentEnv;
}

test("runtime employee resolver builds runtime employee definitions from D1 role policy", async () => {
  const env = createEnv({
    runtimeEmployees: [
      {
        employee_id: "qa001",
        employee_name: "Casey Validation",
        company_id: "company_internal_aep",
        team_id: "team_validation",
        role_id: "reliability-engineer",
        manager_role_id: "infra-ops-manager",
      },
    ],
    runtimeRolePolicies: [
      {
        role_id: "reliability-engineer",
        authority_json: JSON.stringify({
          allowedOperatorActions: ["execute-remediation", "propose-fix"],
          allowedTenants: ["tenant_internal_aep"],
          allowedServices: ["service_control_plane"],
          requireTraceVerification: true,
        }),
        budget_json: JSON.stringify({
          maxActionsPerScan: 7,
          maxActionsPerHour: 17,
          maxActionsPerTenantPerHour: 4,
          tokenBudgetDaily: 0,
          runtimeBudgetMsPerScan: 12000,
          verificationReadsPerAction: 6,
        }),
        escalation_json: JSON.stringify({
          onBudgetExhausted: "notify-human",
          onRepeatedVerificationFailure: "disable-agent",
          onProdTenantAction: "require-manager-approval",
        }),
      },
    ],
  });

  const employee = await resolveRuntimeEmployeeByRole({
    env,
    roleId: "reliability-engineer",
    companyId: "company_internal_aep",
    teamId: "team_validation",
  });

  assert.ok(employee);
  assert.equal(employee.identity.employeeId, "qa001");
  assert.equal(employee.identity.managerRoleId, "infra-ops-manager");
  assert.deepEqual(employee.authority, {
    allowedOperatorActions: ["execute-remediation", "propose-fix"],
    allowedTenants: ["tenant_internal_aep"],
    allowedServices: ["service_control_plane"],
    requireTraceVerification: true,
  });
  assert.deepEqual(employee.budget, {
    maxActionsPerScan: 7,
    maxActionsPerHour: 17,
    maxActionsPerTenantPerHour: 4,
    tokenBudgetDaily: 0,
    runtimeBudgetMsPerScan: 12000,
    verificationReadsPerAction: 6,
  });
  assert.deepEqual(employee.escalation, {
    onBudgetExhausted: "notify-human",
    onRepeatedVerificationFailure: "disable-agent",
    onProdTenantAction: "require-manager-approval",
  });
});

test("runtime employee resolver fails closed when runtime role policy is missing", async () => {
  const env = createEnv({
    runtimeEmployees: [
      {
        employee_id: "op001",
        employee_name: "Taylor Operator",
        company_id: "company_internal_aep",
        team_id: "team_infra",
        role_id: "timeout-recovery-operator",
        manager_role_id: "infra-ops-manager",
      },
    ],
    runtimeRolePolicies: [],
  });

  const employee = await resolveRuntimeEmployeeByRole({
    env,
    roleId: "timeout-recovery-operator",
    companyId: "company_internal_aep",
    teamId: "team_infra",
  });

  assert.equal(employee, undefined);
});