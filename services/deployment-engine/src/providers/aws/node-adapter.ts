import type { DeploymentAdapter, DeployArgs, DeployResult } from "../../types";

export class AwsNodeDeploymentAdapter implements DeploymentAdapter {
  async deployPreview(_args: DeployArgs): Promise<DeployResult> {
    throw new Error("AWS deployment adapter not yet implemented");
  }

  async teardownPreview(_deploymentRef: string): Promise<void> {
    throw new Error("AWS teardown adapter not yet implemented");
  }
}