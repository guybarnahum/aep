export type DeploymentProvider = string;

export type DeployRequest = {
  service_name: string;
  workflow_run_id: string;
  environment_id?: string | null;
};

export type DeployResult =
  | {
      provider: DeploymentProvider;
      deployment_ref: string;
      preview_url?: string;
    }
  | {
      provider: DeploymentProvider;
      deploymentRef: string;
      previewUrl: string;
      metadata?: Record<string, unknown>;
    };

export type TeardownRequest = {
  deployment_ref: string;
};

export type TeardownResult = {
  provider: DeploymentProvider;
  deployment_ref: string;
  status: "destroyed";
};

// Compatibility interfaces for existing adapters and callers.
export interface DeployArgs {
  provider: DeploymentProvider;
  serviceName: string;
  workflowRunId: string;
  repoUrl?: string;
  branch?: string;
}

export interface DeploymentAdapter {
  deployPreview(args: DeployArgs): Promise<DeployResult>;
  teardownPreview(deploymentRef: string): Promise<void>;
}