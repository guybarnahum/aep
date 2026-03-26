export interface OperatorAgentConfig {
  serviceName: string;
  policyVersion: string;
  controlPlaneBaseUrl: string;
  dryRun: boolean;
  cooldownMs: number;
  managerObservedEmployeeId: string;
}

function readEnvString(
  env: Record<string, unknown> | undefined,
  key: string,
  fallback: string
): string {
  const value = env?.[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function readEnvBoolean(
  env: Record<string, unknown> | undefined,
  key: string,
  fallback: boolean
): boolean {
  const value = env?.[key];

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }

  return fallback;
}

function readEnvNumber(
  env: Record<string, unknown> | undefined,
  key: string,
  fallback: number
): number {
  const value = env?.[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

export function getConfig(env?: Record<string, unknown>): OperatorAgentConfig {
  return {
    serviceName: "aep-operator-agent",
    policyVersion: "commit9-stage6",
    controlPlaneBaseUrl: readEnvString(
      env,
      "CONTROL_PLANE_BASE_URL",
      "http://127.0.0.1:8787"
    ),
    dryRun: readEnvBoolean(env, "OPERATOR_AGENT_DRY_RUN", false),
    cooldownMs: readEnvNumber(env, "OPERATOR_AGENT_COOLDOWN_MS", 5 * 60 * 1000),
    managerObservedEmployeeId: readEnvString(
      env,
      "OPERATOR_AGENT_MANAGER_OBSERVED_EMPLOYEE_ID",
      "emp_timeout_recovery_01"
    ),
  };
}
