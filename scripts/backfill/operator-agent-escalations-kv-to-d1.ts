/* eslint-disable no-console */

import { D1EscalationStore } from "../../core/operator-agent/src/lib/escalation-log-d1";
import { KvEscalationStoreAdapter } from "../../core/operator-agent/src/lib/kv-store-adapters";
import type { OperatorAgentEnv } from "../../core/operator-agent/src/types";

export {};

function getEnvFromRuntime(): OperatorAgentEnv {
  throw new Error(
    "getEnvFromRuntime() not implemented. Run this in a Worker-aware runtime or wire env bindings explicitly."
  );
}

async function main(): Promise<void> {
  const env = getEnvFromRuntime();

  const kv = new KvEscalationStoreAdapter(env);
  const d1 = new D1EscalationStore(env);

  const escalations = await kv.list(200);

  let inserted = 0;
  let failed = 0;

  for (const escalation of escalations) {
    try {
      await d1.put(escalation);
      inserted += 1;
    } catch (error) {
      failed += 1;
      console.error("Failed to backfill escalation", {
        escalationId: escalation.escalationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log("operator-agent-escalations-kv-to-d1 backfill complete", {
    scanned: escalations.length,
    inserted,
    failed,
  });
}

main().catch((error) => {
  console.error("operator-agent-escalations-kv-to-d1 backfill failed");
  console.error(error);
  process.exit(1);
});
