import type { Provider } from "../../../packages/shared/src/index";

export interface DeployArgs {
  provider: Provider;
  serviceName: string;
  workflowRunId: string;
  repoUrl?: string;
  branch?: string;
}

export interface DeployResult {
  provider: Provider;
  deploymentRef: string;
  previewUrl: string;
  metadata?: Record<string, unknown>;
}

export interface DeploymentAdapter {
  deployPreview(args: DeployArgs): Promise<DeployResult>;
  teardownPreview(deploymentRef: string): Promise<void>;
}