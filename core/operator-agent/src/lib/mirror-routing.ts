import {
  listMirrorRoutingRules,
  type MirrorRoutingRule,
} from "../persistence/d1/mirror-routing-rule-store-d1";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export type MirrorRoutingContext = {
  threadKind?: string;
  messageType?: string;
  severity?: string;
  visibility?: string;
};

export type ResolvedMirrorRoute = {
  ruleId: string;
  targetAdapter: "slack" | "email";
  targetKey: string;
  targetValue: string;
};

function matchesOptional(
  ruleValue: string | undefined,
  actual: string | undefined,
): boolean {
  return !ruleValue || ruleValue === actual;
}

function ruleMatches(
  rule: MirrorRoutingRule,
  context: MirrorRoutingContext,
): boolean {
  return (
    rule.enabled &&
    matchesOptional(rule.threadKind, context.threadKind) &&
    matchesOptional(rule.messageType, context.messageType) &&
    matchesOptional(rule.severity, context.severity) &&
    matchesOptional(rule.visibility, context.visibility)
  );
}

function resolveTargetValue(env: OperatorAgentEnv, targetKey: string): string | null {
  const value = (env as unknown as Record<string, string | undefined>)[targetKey];
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function resolveMirrorRoutes(
  env: OperatorAgentEnv,
  context: MirrorRoutingContext,
): Promise<{
  routes: ResolvedMirrorRoute[];
  skipped: Array<{
    ruleId: string;
    reason: string;
    targetKey: string;
    targetAdapter: "slack" | "email";
  }>;
}> {
  const rules = await listMirrorRoutingRules(env);
  const routes: ResolvedMirrorRoute[] = [];
  const skipped: Array<{
    ruleId: string;
    reason: string;
    targetKey: string;
    targetAdapter: "slack" | "email";
  }> = [];

  for (const rule of rules) {
    if (!ruleMatches(rule, context)) {
      continue;
    }

    const targetValue = resolveTargetValue(env, rule.targetKey);
    if (!targetValue) {
      skipped.push({
        ruleId: rule.ruleId,
        targetKey: rule.targetKey,
        targetAdapter: rule.targetAdapter,
        reason: "missing_target_config",
      });
      continue;
    }

    routes.push({
      ruleId: rule.ruleId,
      targetAdapter: rule.targetAdapter,
      targetKey: rule.targetKey,
      targetValue,
    });
  }

  return { routes, skipped };
}