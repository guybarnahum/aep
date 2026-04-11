export type WorkLogEntry = Record<string, unknown>;

export type WorkLogResponse = {
  ok: true;
  employeeId: string;
  count: number;
  entries: WorkLogEntry[];
};