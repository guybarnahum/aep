export const SERVICE_CONTROL_PLANE = "service_control_plane" as const;
export const SERVICE_OPERATOR_AGENT = "service_operator_agent" as const;
export const SERVICE_DASHBOARD = "service_dashboard" as const;
export const SERVICE_OPS_CONSOLE = "service_ops_console" as const;

export type ServiceId =
  | typeof SERVICE_CONTROL_PLANE
  | typeof SERVICE_OPERATOR_AGENT
  | typeof SERVICE_DASHBOARD
  | typeof SERVICE_OPS_CONSOLE;