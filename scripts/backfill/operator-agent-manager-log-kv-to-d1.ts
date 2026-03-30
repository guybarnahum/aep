/* eslint-disable no-console */

import { D1ManagerDecisionStore } from "../../core/operator-agent/src/lib/manager-decision-log-d1";
import { KvManagerDecisionStoreAdapter } from "../../core/operator-agent/src/lib/kv-store-adapters";
import type { OperatorAgentEnv } from "../../core/operator-agent/src/types";

export {};

function getEnvFromRuntime(): OperatorAgentEnv {
  throw new Error(
    "getEnvFromRuntime() not implemented. Run this in a Worker-aware runtime or wire env bindings explicitly."
  );
}

async function main(): Promise<void> {
  const env = getEnvFromRuntime();

  const kv = new KvManagerDecisionStoreAdapter(env);
  const d1 = new D1ManagerDecisionStore(env);

  const managerEmployeeIds = ["emp_infra_ops_manager_01"];

  let inserted = 0;
  let failed = 0;

  for (const managerEmployeeId of managerEmployeeIds) {
    const entries = await kv.list({ managerEmployeeId, limit: 500 });

    for (const entry of entries) {
      try {
        await d1.write(entry);
        inserted += 1;
      } catch (error) {
        failed += 1;
        console.error("Failed to backfill manager decision", {
          managerEmployeeId,
          employeeId: entry.employeeId,
          timestamp: entry.timestamp,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  console.log("operator-agent-manager-log-kv-to-d1 backfill complete", {
    inserted,
    failed,
  });
}

main().catch((error) => {
  console.error("operator-agent-manager-log-kv-to-d1 backfill failed");
  console.error(error);
  process.exit(1);
});