import { getConfig } from "../config";
import { ControlPlaneClient } from "../lib/api-client";
import { logInfo } from "../lib/logger";
import { evaluateTimeoutRecoveryPolicy } from "../lib/policy";
import { verifyAdvanceTimeoutApplied } from "../lib/verifier";
import { cloneAuthority } from "../org/authority";
import { cloneBudget } from "../org/budgets";
import { timeoutRecoveryEmployee } from "../org/employees";
import type {
  EmployeeRunRequest,
  EmployeeRunResponse,
  TimeoutRecoveryDecision,
} from "../types";

export async function runTimeoutRecoveryOperator(
  req: EmployeeRunRequest,
  env?: Record<string, unknown>
): Promise<EmployeeRunResponse> {
  const config = getConfig(env);
  const employee = timeoutRecoveryEmployee;
  const authority = cloneAuthority(employee.authority);
  const budget = cloneBudget(employee.budget);
  const client = new ControlPlaneClient(config.controlPlaneBaseUrl);
  const mode = config.dryRun ? "dry-run" : "apply";

  const runs = await client.listRuns();
  const decisions: TimeoutRecoveryDecision[] = [];
  let jobsScanned = 0;

  let eligible = 0;
  let skipped = 0;
  let actionRequested = 0;
  let verifiedApplied = 0;
  let verificationFailed = 0;

  for (const run of runs) {
    const jobs = await client.getRunJobs(run.id);

    for (const job of jobs) {
      jobsScanned += 1;

      const decision = evaluateTimeoutRecoveryPolicy(authority, run, job, mode);

      if (!decision.eligible) {
        skipped += 1;
        decisions.push(decision);
        continue;
      }

      eligible += 1;

      if (config.dryRun) {
        skipped += 1;
        decisions.push(decision);
        continue;
      }

      await client.advanceTimeout(job.id);
      actionRequested += 1;

      const trace = await client.getTrace(run.id);
      const verification = verifyAdvanceTimeoutApplied(trace, job.id);

      if (verification.ok) {
        verifiedApplied += 1;
        decisions.push({
          ...decision,
          result: "verified_applied",
          traceEvidence: verification.evidence,
        });
      } else {
        verificationFailed += 1;
        decisions.push({
          ...decision,
          result: "verification_failed",
          traceEvidence: verification.evidence,
        });
      }
    }
  }

  logInfo("Timeout Recovery Operator run completed", {
    dryRun: config.dryRun,
    runsScanned: runs.length,
    jobsScanned,
    eligible,
    skipped,
    actionRequested,
    verifiedApplied,
    verificationFailed,
  });

  return {
    ok: true,
    status: "completed",
    policyVersion: config.policyVersion,
    trigger: req.trigger,
    employee: employee.identity,
    authority,
    budget,
    controlPlaneBaseUrl: config.controlPlaneBaseUrl,
    dryRun: config.dryRun,
    scanned: {
      runs: runs.length,
      jobs: jobsScanned,
    },
    decisions,
    summary: {
      eligible,
      skipped,
      actionRequested,
      verifiedApplied,
      verificationFailed,
    },
    message: config.dryRun
      ? "Timeout Recovery Operator completed a dry-run scan. No mutation was performed."
      : "Timeout Recovery Operator completed an apply run using the existing operator API and trace verification.",
  };
}
