import { getConfig } from "../config";
import { ControlPlaneClient } from "../lib/api-client";
import { logInfo } from "../lib/logger";
import { evaluateTimeoutRecoveryDryRun } from "../lib/policy";
import { cloneAuthority } from "../org/authority";
import { cloneBudget } from "../org/budgets";
import { timeoutRecoveryEmployee } from "../org/employees";
import type { EmployeeRunRequest, EmployeeRunResponse } from "../types";

export async function runTimeoutRecoveryOperator(
  req: EmployeeRunRequest,
  env?: Record<string, unknown>
): Promise<EmployeeRunResponse> {
  const config = getConfig(env);
  const employee = timeoutRecoveryEmployee;
  const authority = cloneAuthority(employee.authority);
  const budget = cloneBudget(employee.budget);
  const client = new ControlPlaneClient(config.controlPlaneBaseUrl);

  const runs = await client.listRuns();
  const candidates: EmployeeRunResponse["candidates"] = [];
  let jobsScanned = 0;

  for (const run of runs) {
    const jobs = await client.getRunJobs(run.id);

    for (const job of jobs) {
      jobsScanned += 1;
      candidates.push(evaluateTimeoutRecoveryDryRun(authority, run, job));
    }
  }

  logInfo("Timeout Recovery Operator dry-run completed", {
    runsScanned: runs.length,
    jobsScanned,
    candidateCount: candidates.length,
  });

  return {
    ok: true,
    status: "dry_run_completed",
    policyVersion: config.policyVersion,
    trigger: req.trigger,
    employee: employee.identity,
    authority,
    budget,
    controlPlaneBaseUrl: config.controlPlaneBaseUrl,
    scanned: {
      runs: runs.length,
      jobs: jobsScanned,
    },
    candidates,
    message:
      "Timeout Recovery Operator completed a dry-run scan against AEP read APIs. No mutation was performed.",
  };
}
