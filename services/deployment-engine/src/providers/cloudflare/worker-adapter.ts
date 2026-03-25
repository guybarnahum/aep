import type { DeploymentAdapter, DeployArgs, DeployResult } from "@aep/deployment-engine/types";

export class CloudflareWorkerDeploymentAdapter implements DeploymentAdapter {
  async deployPreview(_args: DeployArgs): Promise<DeployResult> {
    throw new Error(
      "Real deployment cannot be executed inside the Worker runtime. Use the Node Wrangler adapter from CI or a deploy runner.",
    );
  }

  async teardownPreview(_deploymentRef: string): Promise<void> {
    throw new Error(
      "Real teardown cannot be executed inside the Worker runtime. Use the Node Wrangler adapter from CI or a deploy runner.",
    );
  }
}