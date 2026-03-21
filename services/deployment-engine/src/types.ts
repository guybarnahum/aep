export interface DeployArgs {
  serviceName: string;
  workflowRunId: string;
}

export interface DeployResult {
  provider: string;
  deploymentRef: string;
  previewUrl: string;
}

export interface DeploymentAdapter {
  deployPreview(args: DeployArgs): Promise<DeployResult>;
  teardownPreview(deploymentRef: string): Promise<void>;
}