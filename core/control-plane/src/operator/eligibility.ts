export type AdvanceTimeoutReason =
  | "job_not_found"
  | "job_terminal"
  | "run_terminal"
  | "attempt_missing"
  | "attempt_not_timeout_eligible";

export type JobOperatorActions = {
  can_advance_timeout: boolean;
  advance_timeout_reason: AdvanceTimeoutReason | null;
};

export function deriveJobOperatorActions(args: {
  runStatus: string | null;
  jobStatus: string | null;
  activeAttemptStatus: string | null;
  activeAttemptNo: number | null;
}): JobOperatorActions {
  if (args.runStatus === "completed" || args.runStatus === "failed") {
    return {
      can_advance_timeout: false,
      advance_timeout_reason: "run_terminal",
    };
  }

  if (args.jobStatus === "succeeded" || args.jobStatus === "failed") {
    return {
      can_advance_timeout: false,
      advance_timeout_reason: "job_terminal",
    };
  }

  if (args.activeAttemptNo === null) {
    return {
      can_advance_timeout: false,
      advance_timeout_reason: "attempt_missing",
    };
  }

  if (
    args.activeAttemptStatus === "queued" ||
    args.activeAttemptStatus === "running"
  ) {
    return {
      can_advance_timeout: true,
      advance_timeout_reason: null,
    };
  }

  return {
    can_advance_timeout: false,
    advance_timeout_reason: "attempt_not_timeout_eligible",
  };
}
