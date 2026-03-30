/* eslint-disable no-console */

import { D1ApprovalStore } from "../../core/operator-agent/src/lib/approval-store-d1";
import { KvApprovalStoreAdapter } from "../../core/operator-agent/src/lib/kv-store-adapters";
import type { OperatorAgentEnv } from "../../core/operator-agent/src/types";

export interface ApprovalsBackfillResult {
  approvalsInserted: number;
  approvalsFailed: number;
}

export async function runApprovalsBackfill(
  env: OperatorAgentEnv
): Promise<ApprovalsBackfillResult> {
  const kv = new KvApprovalStoreAdapter(env);
  const d1 = new D1ApprovalStore(env);

  const approvals = await kv.list({ limit: 100 });

  let inserted = 0;
  let failed = 0;

  for (const approval of approvals) {
    try {
      await d1.put(approval);
      inserted += 1;
    } catch (error) {
      failed += 1;
      console.error("Failed to backfill approval", {
        approvalId: approval.approvalId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log("operator-agent-approvals-kv-to-d1 backfill complete", {
    scanned: approvals.length,
    inserted,
    failed,
  });

  return {
    approvalsInserted: inserted,
    approvalsFailed: failed,
  };
}