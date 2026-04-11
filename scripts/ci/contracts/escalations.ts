export type EscalationEntry = Record<string, unknown>;

export type EscalationsListResponse = {
  ok: true;
  count: number;
  entries: EscalationEntry[];
};

export type ControlHistoryEntry = {
  id?: string;
  timestamp?: string;
  action?: string;
  employeeId?: string;
  [key: string]: unknown;
};

export type ControlHistoryListResponse = {
  ok: true;
  count: number;
  entries: ControlHistoryEntry[];
};