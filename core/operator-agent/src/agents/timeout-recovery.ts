import { getConfig } from "@aep/operator-agent/config";
import { ControlPlaneClient } from "@aep/operator-agent/lib/api-client";
import { BudgetEnforcer } from "@aep/operator-agent/lib/budget-enforcer";
import { CooldownStore } from "@aep/operator-agent/lib/cooldown-store";
import { DecisionLog } from "@aep/operator-agent/lib/decision-log";
import { logInfo } from "@aep/operator-agent/lib/logger";
import { evaluateTimeoutRecoveryPolicy } from "@aep/operator-agent/lib/policy";
import { verifyAdvanceTimeoutApplied } from "@aep/operator-agent/lib/verifier";
import type {
  AgentIdentity,
  AgentWorkLogEntry,
  EmployeeRunResponse,
  OperatorAgentEnv,
  ResolvedEmployeeRunContext,
  TimeoutRecoveryDecision,
  TimeoutRecoveryResult,
} from "@aep/operator-agent/types";

function nowIso(nowMs: number): string {
  return new Date(nowMs).toISOString();
}

function buildWorkLogEntry(args: {
  request: ResolvedEmployeeRunContext["request"];
  policyVersion: string;
  employee: AgentIdentity;
  executionContext?: ResolvedEmployeeRunContext["executionContext"];
  decision: TimeoutRecoveryDecision;
  budgetSnapshot: {
    actionsUsedThisScan: number;
    actionsUsedThisHour: number;
    tenantActionsUsedThisHour: number;
  };
  nowMs: number;
}): AgentWorkLogEntry {
  return {
    timestamp: nowIso(args.nowMs),
    employeeId: args.employee.employeeId,
    employeeName: args.employee.employeeName,
    departmentId: args.employee.departmentId,
    roleId: args.employee.roleId,
    policyVersion: args.policyVersion,
    trigger: args.request.trigger,
    runId: args.decision.runId,
    jobId: args.decision.jobId,
    tenant: args.decision.tenant,
    service: args.decision.service,
    action: "advance-timeout",
    mode: args.decision.mode,
    eligible: args.decision.eligible,
    reason: args.decision.reason,
    result: args.decision.result,
    budgetSnapshot: args.budgetSnapshot,
    traceEvidence: args.decision.traceEvidence,
    errorMessage: args.decision.errorMessage,
    executionContext: args.executionContext,
  };
}

export async function runTimeoutRecoveryOperator(
  context: ResolvedEmployeeRunContext,
  env?: OperatorAgentEnv
): Promise<EmployeeRunResponse> {
  const config = getConfig(env);
  const employee = context.employee;
  const authority = context.authority;
  const budget = context.budget;
  const req = context.request;
  const client = new ControlPlaneClient(config.controlPlaneBaseUrl);
  const mode = config.dryRun ? "dry-run" : "apply";

  const budgetEnforcer = new BudgetEnforcer(
    env ?? {},
    employee.identity.employeeId,
    budget
  );
  const cooldownStore = new CooldownStore(env ?? {}, config.cooldownMs);
  const decisionLog = new DecisionLog(env ?? {});

  const runs = await client.listRuns();
  const decisions: TimeoutRecoveryDecision[] = [];
  let jobsScanned = 0;
  let actionsUsedThisScan = 0;

  let eligible = 0;
  let skipped = 0;
  let actionRequested = 0;
  let verifiedApplied = 0;
  let verificationFailed = 0;
  let operatorActionFailed = 0;
  let skippedBudgetScanExhausted = 0;
  let skippedBudgetHourlyExhausted = 0;
  let skippedBudgetTenantHourlyExhausted = 0;
  let skippedCooldownActive = 0;

  for (const run of runs) {
    const jobs = await client.getRunJobs(run.id);

    for (const job of jobs) {
      jobsScanned += 1;
      const nowMs = Date.now();

      const baseDecision = evaluateTimeoutRecoveryPolicy(authority, run, job, mode);

      if (!baseDecision.eligible) {
        const budgetSnapshot = await budgetEnforcer.getSnapshot({
          tenant: run.tenant,
          actionsUsedThisScan,
          nowMs,
        });

        let result: TimeoutRecoveryResult = "skipped_not_eligible";
        if (baseDecision.reason === "tenant_not_allowed") {
          result = "skipped_tenant_not_allowed";
        } else if (baseDecision.reason === "service_not_allowed") {
          result = "skipped_service_not_allowed";
        }

        const decision: TimeoutRecoveryDecision = {
          ...baseDecision,
          result,
          budgetSnapshot,
        };

        skipped += 1;
        decisions.push(decision);

        await decisionLog.write(
          buildWorkLogEntry({
            request: req,
            policyVersion: context.policyVersion,
            employee: employee.identity,
            executionContext: context.executionContext,
            decision,
            budgetSnapshot,
            nowMs,
          })
        );
        continue;
      }

      eligible += 1;

      const budgetCheck = await budgetEnforcer.check({
        tenant: run.tenant,
        actionsUsedThisScan,
        nowMs,
      });

      if (!budgetCheck.allowed) {
        const decision: TimeoutRecoveryDecision = {
          ...baseDecision,
          result: budgetCheck.reason,
          budgetSnapshot: budgetCheck.snapshot,
        };

        skipped += 1;
        decisions.push(decision);

        if (budgetCheck.reason === "skipped_budget_scan_exhausted") {
          skippedBudgetScanExhausted += 1;
        } else if (budgetCheck.reason === "skipped_budget_hourly_exhausted") {
          skippedBudgetHourlyExhausted += 1;
        } else {
          skippedBudgetTenantHourlyExhausted += 1;
        }

        await decisionLog.write(
          buildWorkLogEntry({
            request: req,
            policyVersion: context.policyVersion,
            employee: employee.identity,
            executionContext: context.executionContext,
            decision,
            budgetSnapshot: budgetCheck.snapshot,
            nowMs,
          })
        );
        continue;
      }

      const cooldownActive = await cooldownStore.isActive(job.id, nowMs);
      if (cooldownActive) {
        const decision: TimeoutRecoveryDecision = {
          ...baseDecision,
          result: "skipped_cooldown_active",
          budgetSnapshot: budgetCheck.snapshot,
        };

        skipped += 1;
        skippedCooldownActive += 1;
        decisions.push(decision);

        await decisionLog.write(
          buildWorkLogEntry({
            request: req,
            policyVersion: context.policyVersion,
            employee: employee.identity,
            executionContext: context.executionContext,
            decision,
            budgetSnapshot: budgetCheck.snapshot,
            nowMs,
          })
        );
        continue;
      }

      if (config.dryRun) {
        const decision: TimeoutRecoveryDecision = {
          ...baseDecision,
          result: "action_requested",
          budgetSnapshot: budgetCheck.snapshot,
        };

        actionsUsedThisScan += 1;
        actionRequested += 1;
        decisions.push(decision);

        await decisionLog.write(
          buildWorkLogEntry({
            request: req,
            policyVersion: context.policyVersion,
            employee: employee.identity,
            executionContext: context.executionContext,
            decision,
            budgetSnapshot: budgetCheck.snapshot,
            nowMs,
          })
        );
        continue;
      }

      try {
        await client.advanceTimeout(job.id);
        await cooldownStore.mark(job.id, nowMs);
        await budgetEnforcer.recordAction({
          tenant: run.tenant,
          nowMs,
        });

        actionsUsedThisScan += 1;
        actionRequested += 1;

        const trace = await client.getTrace(run.id);
        const verification = verifyAdvanceTimeoutApplied(trace, job.id);

        const postActionSnapshot = await budgetEnforcer.getSnapshot({
          tenant: run.tenant,
          actionsUsedThisScan,
          nowMs,
        });

        const decision: TimeoutRecoveryDecision = verification.ok
          ? {
              ...baseDecision,
              result: "verified_applied",
              traceEvidence: verification.evidence,
              budgetSnapshot: postActionSnapshot,
            }
          : {
              ...baseDecision,
              result: "verification_failed",
              traceEvidence: verification.evidence,
              budgetSnapshot: postActionSnapshot,
            };

        if (verification.ok) {
          verifiedApplied += 1;
        } else {
          verificationFailed += 1;
        }

        decisions.push(decision);

        await decisionLog.write(
          buildWorkLogEntry({
            request: req,
            policyVersion: context.policyVersion,
            employee: employee.identity,
            executionContext: context.executionContext,
            decision,
            budgetSnapshot: postActionSnapshot,
            nowMs,
          })
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        const snapshot = await budgetEnforcer.getSnapshot({
          tenant: run.tenant,
          actionsUsedThisScan,
          nowMs,
        });

        const decision: TimeoutRecoveryDecision = {
          ...baseDecision,
          result: "operator_action_failed",
          errorMessage,
          budgetSnapshot: snapshot,
        };

        operatorActionFailed += 1;
        decisions.push(decision);

        await decisionLog.write(
          buildWorkLogEntry({
            request: req,
            policyVersion: context.policyVersion,
            employee: employee.identity,
            executionContext: context.executionContext,
            decision,
            budgetSnapshot: snapshot,
            nowMs,
          })
        );
      }
    }
  }

  logInfo("Timeout Recovery Operator run completed", {
    dryRun: config.dryRun,
    runsScanned: runs.length,
    jobsScanned,
    actionsUsedThisScan,
    eligible,
    skipped,
    actionRequested,
    verifiedApplied,
    verificationFailed,
    operatorActionFailed,
    skippedBudgetScanExhausted,
    skippedBudgetHourlyExhausted,
    skippedBudgetTenantHourlyExhausted,
    skippedCooldownActive,
  });

  return {
    ok: true,
    status: "completed",
    policyVersion: context.policyVersion,
    trigger: req.trigger,
    employee: employee.identity,
    workerRole: "timeout-recovery-operator",
    baseAuthority: context.employee.authority,
    baseBudget: context.employee.budget,
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
      operatorActionFailed,
      skippedBudgetScanExhausted,
      skippedBudgetHourlyExhausted,
      skippedBudgetTenantHourlyExhausted,
      skippedCooldownActive,
    },
    message: config.dryRun
      ? "Timeout Recovery Operator completed a dry-run run with budget checks, cooldown checks, and structured work logging."
      : "Timeout Recovery Operator completed an apply run with budget checks, cooldown checks, structured work logging, and trace verification.",
  };
}
