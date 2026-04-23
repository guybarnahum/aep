import type {
  AgentAuthority,
  AgentBudget,
  EscalationPolicy,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

export interface RuntimeRolePolicyRecord {
  roleId: string;
  authority: AgentAuthority;
  budget: AgentBudget;
  escalation: EscalationPolicy;
}

export interface UpsertRuntimeRolePolicyInput {
  roleId: string;
  authority: AgentAuthority;
  budget: AgentBudget;
  escalation: EscalationPolicy;
  updatedBy?: string;
  reason?: string;
}

type RuntimeRolePolicyRow = {
  role_id: string;
  authority_json: string;
  budget_json: string;
  escalation_json: string;
};

const ALLOWED_OPERATOR_ACTIONS = new Set([
  "advance-timeout",
  "execute-remediation",
  "propose-fix",
]);

const ALLOWED_ESCALATION_ACTIONS = new Set([
  "notify-human",
  "disable-agent",
  "require-manager-approval",
]);

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }

  return env.OPERATOR_AGENT_DB;
}

function parseJsonObject<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Invalid ${label} JSON in runtime_role_policies`);
  }
}

function rowToRecord(row: RuntimeRolePolicyRow): RuntimeRolePolicyRecord {
  return {
    roleId: row.role_id,
    authority: parseJsonObject<AgentAuthority>(row.authority_json, "authority"),
    budget: parseJsonObject<AgentBudget>(row.budget_json, "budget"),
    escalation: parseJsonObject<EscalationPolicy>(row.escalation_json, "escalation"),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireStringArray(
  value: unknown,
  label: string,
  options?: {
    allowedValues?: Set<string>;
  },
): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }

  const out = value.map((entry) => {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new Error(`${label} entries must be non-empty strings`);
    }

    return entry.trim();
  });

  if (options?.allowedValues) {
    for (const entry of out) {
      if (!options.allowedValues.has(entry)) {
        throw new Error(`${label} contains unsupported value: ${entry}`);
      }
    }
  }

  return [...new Set(out)];
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number`);
  }

  return value;
}

function requireEscalationAction(value: unknown, label: string): string {
  if (typeof value !== "string" || !ALLOWED_ESCALATION_ACTIONS.has(value)) {
    throw new Error(
      `${label} must be one of ${[...ALLOWED_ESCALATION_ACTIONS].join(", ")}`,
    );
  }

  return value;
}

export function validateRuntimeRolePolicyInput(
  input: UpsertRuntimeRolePolicyInput,
): UpsertRuntimeRolePolicyInput {
  if (!input.roleId || typeof input.roleId !== "string") {
    throw new Error("roleId is required");
  }

  if (!isPlainObject(input.authority)) {
    throw new Error("authority must be an object");
  }
  if (!isPlainObject(input.budget)) {
    throw new Error("budget must be an object");
  }
  if (!isPlainObject(input.escalation)) {
    throw new Error("escalation must be an object");
  }

  const authority = input.authority as Record<string, unknown>;
  const budget = input.budget as Record<string, unknown>;
  const escalation = input.escalation as Record<string, unknown>;

  return {
    roleId: input.roleId.trim(),
    updatedBy: input.updatedBy?.trim() || undefined,
    reason: input.reason?.trim() || undefined,
    authority: {
      allowedOperatorActions: requireStringArray(
        authority.allowedOperatorActions,
        "authority.allowedOperatorActions",
        { allowedValues: ALLOWED_OPERATOR_ACTIONS },
      ) as AgentAuthority["allowedOperatorActions"],
      ...(authority.allowedTenants === undefined
        ? {}
        : {
            allowedTenants: requireStringArray(
              authority.allowedTenants,
              "authority.allowedTenants",
            ),
          }),
      ...(authority.allowedServices === undefined
        ? {}
        : {
            allowedServices: requireStringArray(
              authority.allowedServices,
              "authority.allowedServices",
            ),
          }),
      ...(authority.allowedEnvironmentNames === undefined
        ? {}
        : {
            allowedEnvironmentNames: requireStringArray(
              authority.allowedEnvironmentNames,
              "authority.allowedEnvironmentNames",
            ),
          }),
      requireTraceVerification: authority.requireTraceVerification === true,
    },
    budget: {
      maxActionsPerScan: requireNumber(
        budget.maxActionsPerScan,
        "budget.maxActionsPerScan",
      ),
      maxActionsPerHour: requireNumber(
        budget.maxActionsPerHour,
        "budget.maxActionsPerHour",
      ),
      maxActionsPerTenantPerHour: requireNumber(
        budget.maxActionsPerTenantPerHour,
        "budget.maxActionsPerTenantPerHour",
      ),
      tokenBudgetDaily: requireNumber(
        budget.tokenBudgetDaily,
        "budget.tokenBudgetDaily",
      ),
      runtimeBudgetMsPerScan: requireNumber(
        budget.runtimeBudgetMsPerScan,
        "budget.runtimeBudgetMsPerScan",
      ),
      verificationReadsPerAction: requireNumber(
        budget.verificationReadsPerAction,
        "budget.verificationReadsPerAction",
      ),
    },
    escalation: {
      onBudgetExhausted: requireEscalationAction(
        escalation.onBudgetExhausted,
        "escalation.onBudgetExhausted",
      ) as EscalationPolicy["onBudgetExhausted"],
      onRepeatedVerificationFailure: requireEscalationAction(
        escalation.onRepeatedVerificationFailure,
        "escalation.onRepeatedVerificationFailure",
      ) as EscalationPolicy["onRepeatedVerificationFailure"],
      onProdTenantAction: requireEscalationAction(
        escalation.onProdTenantAction,
        "escalation.onProdTenantAction",
      ) as EscalationPolicy["onProdTenantAction"],
    },
  };
}

export async function getRuntimeRolePolicy(
  env: OperatorAgentEnv,
  roleId: string,
): Promise<RuntimeRolePolicyRecord | null> {
  const db = requireDb(env);
  const row = await db
    .prepare(
      `SELECT role_id, authority_json, budget_json, escalation_json
       FROM runtime_role_policies
       WHERE role_id = ?
       LIMIT 1`,
    )
    .bind(roleId)
    .first<RuntimeRolePolicyRow>();

  return row ? rowToRecord(row) : null;
}

export async function listRuntimeRolePolicies(
  env: OperatorAgentEnv,
): Promise<RuntimeRolePolicyRecord[]> {
  const db = requireDb(env);
  const rows = await db
    .prepare(
      `SELECT role_id, authority_json, budget_json, escalation_json
       FROM runtime_role_policies
       ORDER BY role_id`,
    )
    .all<RuntimeRolePolicyRow>();

  return (rows.results ?? []).map(rowToRecord);
}

export async function upsertRuntimeRolePolicy(
  env: OperatorAgentEnv,
  input: UpsertRuntimeRolePolicyInput,
): Promise<RuntimeRolePolicyRecord> {
  const db = requireDb(env);
  const validated = validateRuntimeRolePolicyInput(input);
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO runtime_role_policies (
         role_id,
         authority_json,
         budget_json,
         escalation_json,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(role_id) DO UPDATE SET
         authority_json = excluded.authority_json,
         budget_json = excluded.budget_json,
         escalation_json = excluded.escalation_json,
         updated_at = excluded.updated_at`,
    )
    .bind(
      validated.roleId,
      JSON.stringify(validated.authority),
      JSON.stringify(validated.budget),
      JSON.stringify(validated.escalation),
      now,
      now,
    )
    .run();

  const saved = await getRuntimeRolePolicy(env, validated.roleId);
  if (!saved) {
    throw new Error(`Failed to read saved runtime role policy: ${validated.roleId}`);
  }

  return saved;
}