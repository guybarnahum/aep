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

export class CloudflarePreviewAdapter implements DeploymentAdapter {
  async deployPreview(args: DeployArgs): Promise<DeployResult> {
    return {
      provider: "cloudflare",
      deploymentRef: `preview:${args.workflowRunId}`,
      previewUrl: `https://${args.serviceName}-${args.workflowRunId}.example.workers.dev`,
    };
  }

  async teardownPreview(_deploymentRef: string): Promise<void> {
    // Replace with real Wrangler or Cloudflare API teardown.
  }
}
