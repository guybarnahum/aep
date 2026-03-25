import type {
  AgentAuthority,
  JobSummary,
  RunSummary,
  TimeoutRecoveryDryRunDecision,
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

export function evaluateTimeoutRecoveryDryRun(
  authority: AgentAuthority,
  run: RunSummary,
  job: JobSummary
): TimeoutRecoveryDryRunDecision {
  if (!tenantAllowed(authority, run)) {
    return {
      runId: run.id,
      jobId: job.id,
      tenant: run.tenant,
      service: run.service,
      jobType: job.job_type,
      jobStatus: job.status,
      action: "would-advance-timeout",
      mode: "dry-run",
      eligible: false,
      reason: "tenant_not_allowed",
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
      action: "would-advance-timeout",
      mode: "dry-run",
      eligible: false,
      reason: "service_not_allowed",
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
      action: "would-advance-timeout",
      mode: "dry-run",
      eligible: false,
      reason: "not_timeout_eligible",
    };
  }

  return {
    runId: run.id,
    jobId: job.id,
    tenant: run.tenant,
    service: run.service,
    jobType: job.job_type,
    jobStatus: job.status,
    action: "would-advance-timeout",
    mode: "dry-run",
    eligible: true,
    reason: "eligible_timeout_recovery",
  };
}
