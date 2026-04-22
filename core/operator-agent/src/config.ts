import {
  EMPLOYEE_RETRY_SUPERVISOR_ID,
  EMPLOYEE_TIMEOUT_RECOVERY_ID,
} from "@aep/operator-agent/org/employee-ids";

export interface OperatorAgentConfig {
  serviceName: string;
  policyVersion: string;
  controlPlaneBaseUrl: string;
  controlPlaneTarget: string;
  dryRun: boolean;
  cronFallbackEnabled: boolean;
  paperclipAuthRequired: boolean;
  paperclipSharedSecret: string;
  cooldownMs: number;
  managerObservedEmployeeId: string;
  managerObservedEmployeeIds: string[];
  managerReviewWindowMs: number;
  managerQuietPeriodMs: number;
  syntheticEmployeeCleanupToken: string;
}

function readEnvString(
  env: Record<string, unknown> | undefined,
  key: string,
  fallback: string
): string {
  const value = env?.[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function readEnvStringArray(
  env: Record<string, unknown> | undefined,
  key: string,
  fallback: string[]
): string[] {
  const value = env?.[key];
  if (typeof value === "string" && value.length > 0) {
    return value.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  }
  return fallback;
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

function resolveControlPlaneTarget(
  env: Record<string, unknown> | undefined,
  controlPlaneBaseUrl: string
): string {
  const binding = env?.CONTROL_PLANE;

  if (
    typeof binding === "object" &&
    binding !== null &&
    "fetch" in binding &&
    typeof (binding as { fetch?: unknown }).fetch === "function"
  ) {
    return "service-binding:CONTROL_PLANE";
  }

  return controlPlaneBaseUrl;
}

export function getConfig(env?: Record<string, unknown>): OperatorAgentConfig {
  const controlPlaneBaseUrl = readEnvString(
    env,
    "CONTROL_PLANE_BASE_URL",
    "http://127.0.0.1:8787"
  );

  return {
    serviceName: "aep-operator-agent",
    policyVersion: "commit10-stageD",
    controlPlaneBaseUrl,
    controlPlaneTarget: resolveControlPlaneTarget(env, controlPlaneBaseUrl),
    dryRun: readEnvBoolean(env, "OPERATOR_AGENT_DRY_RUN", false),
    cronFallbackEnabled: readEnvBoolean(
      env,
      "AEP_CRON_FALLBACK_ENABLED",
      true
    ),
    paperclipAuthRequired: readEnvBoolean(
      env,
      "PAPERCLIP_AUTH_REQUIRED",
      false
    ),
    paperclipSharedSecret: readEnvString(env, "PAPERCLIP_SHARED_SECRET", ""),
    cooldownMs: readEnvNumber(env, "OPERATOR_AGENT_COOLDOWN_MS", 5 * 60 * 1000),
    managerObservedEmployeeId: readEnvString(
      env,
      "OPERATOR_AGENT_MANAGER_OBSERVED_EMPLOYEE_ID",
      EMPLOYEE_TIMEOUT_RECOVERY_ID
    ),
    managerObservedEmployeeIds: readEnvStringArray(
      env,
      "OPERATOR_AGENT_MANAGER_OBSERVED_EMPLOYEE_IDS",
      [EMPLOYEE_TIMEOUT_RECOVERY_ID, EMPLOYEE_RETRY_SUPERVISOR_ID]
    ),
    managerReviewWindowMs: readEnvNumber(
      env,
      "OPERATOR_AGENT_MANAGER_REVIEW_WINDOW_MS",
      15 * 60 * 1000
    ),
    managerQuietPeriodMs: readEnvNumber(
      env,
      "OPERATOR_AGENT_MANAGER_QUIET_PERIOD_MS",
      15 * 60 * 1000
    ),
    syntheticEmployeeCleanupToken: readEnvString(
      env,
      "SYNTHETIC_EMPLOYEE_CLEANUP_TOKEN",
      ""
    ),
  };
}
