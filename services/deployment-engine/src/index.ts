import { CloudflareWranglerAdapter } from "./cloudflare-adapter";

export type {
  DeployArgs,
  DeployResult,
  DeploymentAdapter,
} from "./types";

export class CloudflarePreviewAdapter implements DeploymentAdapter {
  private readonly adapter = new CloudflareWranglerAdapter();

  async deployPreview(args: DeployArgs): Promise<DeployResult> {
    const result = this.adapter.deploy({
      serviceName: args.serviceName,
      workingDir: "examples/sample-worker",
      envId: args.workflowRunId,
    });

    return {
      provider: "cloudflare",
      deploymentRef: result.deploymentId,
      previewUrl: result.url,
    };
  }

  async teardownPreview(deploymentRef: string): Promise<void> {
    // Commit 1 note:
    // Keep teardown as a no-op placeholder until Commit 3.
    // At that point, this should call a real Wrangler/API delete flow.
    console.log(`[teardown] not yet implemented for ${deploymentRef}`);
  }
}