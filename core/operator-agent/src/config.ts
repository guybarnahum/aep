export interface OperatorAgentConfig {
  serviceName: string;
  policyVersion: string;
  controlPlaneBaseUrl: string;
  dryRun: boolean;
}

function readEnvString(
  env: Record<string, unknown> | undefined,
  key: string,
  fallback: string
): string {
  const value = env?.[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export function getConfig(env?: Record<string, unknown>): OperatorAgentConfig {
  return {
    serviceName: "aep-operator-agent",
    policyVersion: "commit8-stage2",
    controlPlaneBaseUrl: readEnvString(
      env,
      "CONTROL_PLANE_BASE_URL",
      "http://127.0.0.1:8787"
    ),
    dryRun: true,
  };
}
