/* eslint-disable no-console */

import { D1EmployeeControlHistoryStore } from "../../core/operator-agent/src/lib/control-history-log-d1";
import { D1EmployeeControlStore } from "../../core/operator-agent/src/lib/employee-control-store-d1";
import {
  KvEmployeeControlHistoryStoreAdapter,
  KvEmployeeControlStoreAdapter,
} from "../../core/operator-agent/src/lib/kv-store-adapters";
import type { OperatorAgentEnv } from "../../core/operator-agent/src/types";

export interface ControlsBackfillResult {
  controlsInserted: number;
  historyInserted: number;
}

export async function runControlsBackfill(
  env: OperatorAgentEnv
): Promise<ControlsBackfillResult> {
  const kvControls = new KvEmployeeControlStoreAdapter(env);
  const kvHistory = new KvEmployeeControlHistoryStoreAdapter(env);
  const d1Controls = new D1EmployeeControlStore(env);
  const d1History = new D1EmployeeControlHistoryStore(env);

  const employeeIds = [
    "emp_timeout_recovery_01",
    "emp_retry_supervisor_01",
    "emp_infra_ops_manager_01",
  ];

  let controlsInserted = 0;
  let historyInserted = 0;

  for (const employeeId of employeeIds) {
    const control = await kvControls.get(employeeId);
    if (control) {
      await d1Controls.put(control);
      controlsInserted += 1;
    }

    const historyEntries = await kvHistory.list({ employeeId, limit: 500 });
    for (const entry of historyEntries) {
      await d1History.write(entry);
      historyInserted += 1;
    }
  }

  console.log("operator-agent-controls-kv-to-d1 backfill complete", {
    controlsInserted,
    historyInserted,
  });

  return {
    controlsInserted,
    historyInserted,
  };
}