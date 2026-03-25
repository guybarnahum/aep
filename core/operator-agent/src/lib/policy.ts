import type {
  AgentAuthority,
  JobSummary,
  RunSummary,
  TimeoutRecoveryDecision,
  TimeoutRecoveryMode,
} from "../types";

function tenantAllowed(authority: AgentAuthority, run: RunSummary): boolean {
  if (!authority.allowedTenants || authority.allowedTenants.length === 0) {
    return true;
  }

  if (!run.tenant) {
    return false;
  }

  return authority.allowedTenants.includes(run.tenant);
}

function serviceAllowed(authority: AgentAuthority, run: RunSummary): boolean {
  if (!authority.allowedServices || authority.allowedServices.length === 0) {
    return true;
  }

  if (!run.service) {
    return false;
  }

  return authority.allowedServices.includes(run.service);
}

export function evaluateTimeoutRecoveryPolicy(
  authority: AgentAuthority,
  run: RunSummary,
  job: JobSummary,
  mode: TimeoutRecoveryMode
): TimeoutRecoveryDecision {
  if (!tenantAllowed(authority, run)) {
    return {
      runId: run.id,
      jobId: job.id,
      tenant: run.tenant,
      service: run.service,
      jobType: job.job_type,
      jobStatus: job.status,
      action: "advance-timeout",
      mode,
      eligible: false,
      reason: "tenant_not_allowed",
      result: "skipped",
    };
  }

  if (!serviceAllowed(authority, run)) {
    return {
      runId: run.id,
      jobId: job.id,
      tenant: run.tenant,
      service: run.service,
      jobType: job.job_type,
      jobStatus: job.status,
      action: "advance-timeout",
      mode,
      eligible: false,
      reason: "service_not_allowed",
      result: "skipped",
    };
  }

  if (!job.operator_actions?.can_advance_timeout) {
    return {
      runId: run.id,
      jobId: job.id,
      tenant: run.tenant,
      service: run.service,
      jobType: job.job_type,
      jobStatus: job.status,
      action: "advance-timeout",
      mode,
      eligible: false,
      reason: "not_timeout_eligible",
      result: "skipped",
    };
  }

  return {
    runId: run.id,
    jobId: job.id,
    tenant: run.tenant,
    service: run.service,
    jobType: job.job_type,
    jobStatus: job.status,
    action: "advance-timeout",
    mode,
    eligible: true,
    reason: "eligible_timeout_recovery",
    result: mode === "dry-run" ? "skipped" : "action_requested",
  };
}
