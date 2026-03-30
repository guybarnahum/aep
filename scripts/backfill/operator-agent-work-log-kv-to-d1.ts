/* eslint-disable no-console */

import { KvAgentWorkLogStoreAdapter } from "../../core/operator-agent/src/lib/kv-store-adapters";
import { D1AgentWorkLogStore } from "../../core/operator-agent/src/lib/work-log-store-d1";
import type { OperatorAgentEnv } from "../../core/operator-agent/src/types";

export {};

function getEnvFromRuntime(): OperatorAgentEnv {
  throw new Error(
    "getEnvFromRuntime() not implemented. Run this in a Worker-aware runtime or wire env bindings explicitly."
  );
}

async function main(): Promise<void> {
  const env = getEnvFromRuntime();

  const kv = new KvAgentWorkLogStoreAdapter(env);
  const d1 = new D1AgentWorkLogStore(env);

  const employeeIds = [
    "emp_timeout_recovery_01",
    "emp_retry_supervisor_01",
    "emp_infra_ops_manager_01",
  ];

  let inserted = 0;
  let failed = 0;

  for (const employeeId of employeeIds) {
    const entries = await kv.listByEmployee({ employeeId, limit: 1000 });

    for (const entry of entries) {
      try {
        await d1.write(entry);
        inserted += 1;
      } catch (error) {
        failed += 1;
        console.error("Failed to backfill work log entry", {
          employeeId,
          jobId: entry.jobId,
          timestamp: entry.timestamp,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  console.log("operator-agent-work-log-kv-to-d1 backfill complete", {
    inserted,
    failed,
  });
}

main().catch((error) => {
  console.error("operator-agent-work-log-kv-to-d1 backfill failed");
  console.error(error);
  process.exit(1);
});
