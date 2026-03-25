import type { JobStatus, RunStatus } from "./types";

type RawRunRecord = {
  status?: string | null;
  completed_at?: string | null;
};

type RawAttemptRecord = {
  attempt_no?: number | null;
  status?: string | null;
};

type RawJobRecord = {
  status?: string | null;
};

export function deriveRunStatus(args: {
  run: RawRunRecord;
  jobs: RawJobRecord[];
  attempts: RawAttemptRecord[];
}): RunStatus {
  if (args.run.status === "completed" || args.run.completed_at) {
    return "completed";
  }

  if (args.run.status === "failed") {
    return "failed";
  }

  const hasWaitingJob = args.jobs.some(
    (job) => job.status === "waiting" || job.status === "retry_scheduled",
  );
  if (hasWaitingJob) {
    return "waiting";
  }

  const hasRunningAttempt = args.attempts.some(
    (attempt) => attempt.status === "running" || attempt.status === "queued",
  );
  if (hasRunningAttempt) {
    return "running";
  }

  const hasFailedAttempt = args.attempts.some(
    (attempt) => attempt.status === "failed",
  );
  if (hasFailedAttempt) {
    return "failed";
  }

  return "running";
}

export function deriveJobStatus(args: {
  jobStatus?: string | null;
  attempts: RawAttemptRecord[];
}): JobStatus {
  if (args.jobStatus === "completed" || args.jobStatus === "succeeded") {
    return "completed";
  }

  if (args.jobStatus === "failed") return "failed";

  if (args.jobStatus === "waiting" || args.jobStatus === "retry_scheduled") {
    return "waiting";
  }

  if (args.jobStatus === "running") return "running";

  const latestAttempt = [...args.attempts].sort(
    (a, b) => (b.attempt_no ?? 0) - (a.attempt_no ?? 0),
  )[0];

  if (!latestAttempt) return null;
  if (latestAttempt.status === "succeeded") return "completed";
  if (latestAttempt.status === "failed") return "failed";

  if (latestAttempt.status === "running" || latestAttempt.status === "queued") {
    return "running";
  }

  return null;
}

export function deriveActiveAttempt(
  attempts: RawAttemptRecord[],
): number | null {
  const latestAttempt = [...attempts].sort(
    (a, b) => (b.attempt_no ?? 0) - (a.attempt_no ?? 0),
  )[0];

  return latestAttempt?.attempt_no ?? null;
}

export function deriveLatestFailureKind(
  attempts: RawAttemptRecord[],
  jobs: RawJobRecord[] = [],
  runStatus?: string | null,
): string | null {
  const failedAttempt = [...attempts]
    .filter((attempt) => attempt.status === "failed")
    .sort((a, b) => (b.attempt_no ?? 0) - (a.attempt_no ?? 0))[0];

  if (failedAttempt) {
    return "attempt_failed";
  }

  const failedJob = jobs.find((job) => job.status === "failed");
  if (failedJob) {
    return "job_failed";
  }

  if (runStatus === "failed") {
    return "workflow_failed";
  }

  return null;
}

export function deriveEnvironmentName(branch: string | null): string {
  if (!branch) return "validation";

  const normalized = branch.toLowerCase();
  if (normalized.includes("prod")) return "prod";
  if (normalized.includes("stage")) return "staging";
  if (normalized.includes("valid")) return "validation";
  if (normalized.includes("qa")) return "qa";
  if (normalized.includes("dev")) return "dev";

  return "validation";
}

export function deriveUpdatedAt(values: Array<string | null | undefined>): string | null {
  const filtered = values.filter((value): value is string => !!value);
  if (filtered.length === 0) return null;

  return filtered.sort().at(-1) ?? null;
}