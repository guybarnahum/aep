export function managerDecisionId(args: {
  managerEmployeeId: string;
  timestamp: string;
  employeeId: string;
  reason: string;
}): string {
  return [
    args.managerEmployeeId,
    args.timestamp,
    args.employeeId,
    args.reason,
  ].join(":");
}

export function agentWorkLogEntryId(args: {
  employeeId: string;
  timestamp: string;
  jobId: string;
}): string {
  return [args.employeeId, args.timestamp, args.jobId].join(":");
}

export function controlHistoryId(args: {
  employeeId: string;
  timestamp: string;
}): string {
  return [args.employeeId, args.timestamp].join(":");
}
