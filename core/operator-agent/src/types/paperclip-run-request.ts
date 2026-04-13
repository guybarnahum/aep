export interface PaperclipRunRequestEnvelope {
  companyId: string;
  taskId: string;
  workOrderId?: string; // Legacy compatibility alias
  heartbeatId: string;
  workflowKind?: string;
  requestedBy?: string;
  employeeId?: string;
  workerId?: string;
  input?: Record<string, unknown>;
}
