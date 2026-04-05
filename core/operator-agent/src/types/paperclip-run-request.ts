export interface PaperclipRunRequestEnvelope {
  companyId: string;
  workOrderId?: string;
  taskId: string;
  heartbeatId: string;
  workflowKind?: string;
  requestedBy?: string;
  employeeId?: string;
  workerId?: string;
  input?: Record<string, unknown>;
}
