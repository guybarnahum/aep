export interface OperatorAgentConfig {
  serviceName: string;
  policyVersion: string;
}

export function getConfig(): OperatorAgentConfig {
  return {
    serviceName: "aep-operator-agent",
    policyVersion: "commit8-stage1",
  };
}
