export type ManagerDecisionEntry = Record<string, unknown>;

export type ManagerLogResponse = {
  ok: true;
  managerEmployeeId: string;
  count: number;
  entries: ManagerDecisionEntry[];
};

export type ManagerRunSummary = {
  repeatedVerificationFailures: number;
  operatorActionFailures: number;
  budgetExhaustionSignals: number;
  reEnableDecisions: number;
  restrictionDecisions: number;
  clearedRestrictionDecisions: number;
  decisionsEmitted: number;
};

export type ManagerRunResponse = {
  ok: true;
  status: "completed";
  policyVersion: string;
  summary: ManagerRunSummary;
};