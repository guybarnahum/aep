import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export type MirrorTargetAdapter = "slack" | "email";

export type MirrorRoutingRule = {
  ruleId: string;
  enabled: boolean;
  threadKind?: string;
  messageType?: string;
  severity?: string;
  visibility?: string;
  targetAdapter: MirrorTargetAdapter;
  targetKey: string;
};

type MirrorRoutingRuleRow = {
  rule_id: string;
  enabled: number | string;
  thread_kind?: string | null;
  message_type?: string | null;
  severity?: string | null;
  visibility?: string | null;
  target_adapter: string;
  target_key: string;
};

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }

  return env.OPERATOR_AGENT_DB;
}

function rowToRule(row: MirrorRoutingRuleRow): MirrorRoutingRule {
  return {
    ruleId: row.rule_id,
    enabled: row.enabled === 1 || row.enabled === "1",
    threadKind: row.thread_kind ?? undefined,
    messageType: row.message_type ?? undefined,
    severity: row.severity ?? undefined,
    visibility: row.visibility ?? undefined,
    targetAdapter: row.target_adapter as MirrorTargetAdapter,
    targetKey: row.target_key,
  };
}

export async function listMirrorRoutingRules(
  env: OperatorAgentEnv,
): Promise<MirrorRoutingRule[]> {
  const rows = await requireDb(env)
    .prepare(
      `SELECT
         rule_id,
         enabled,
         thread_kind,
         message_type,
         severity,
         visibility,
         target_adapter,
         target_key
       FROM mirror_routing_rules
       ORDER BY rule_id`,
    )
    .all<MirrorRoutingRuleRow>();

  return (rows.results ?? []).map(rowToRule);
}