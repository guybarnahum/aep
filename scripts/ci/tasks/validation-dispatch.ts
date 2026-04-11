export type ValidationDispatchArgs = {
  baseUrl: string;
  mode: string;
  requestedBy: string;
  dispatchBatchId?: string;
};

export function buildDispatchArgs(args: ValidationDispatchArgs): string[] {
  const result = [
    "--base-url",
    args.baseUrl,
    "--mode",
    args.mode,
    "--requested-by",
    args.requestedBy,
  ];

  if (args.dispatchBatchId) {
    result.push("--dispatch-batch-id", args.dispatchBatchId);
  }

  return result;
}

export function buildVerdictArgs(args: {
  baseUrl: string;
  freshnessMinutes: string;
  dispatchBatchId?: string;
}): string[] {
  const result = [
    "--base-url",
    args.baseUrl,
    "--freshness-minutes",
    args.freshnessMinutes,
  ];

  if (args.dispatchBatchId) {
    result.push("--dispatch-batch-id", args.dispatchBatchId);
  }

  return result;
}