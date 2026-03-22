import type { DeploymentAdapter, DeployArgs, DeployResult } from "../../types";

export class AwsWorkerDeploymentAdapter implements DeploymentAdapter {
  async deployPreview(_args: DeployArgs): Promise<DeployResult> {
    throw new Error("AWS Worker deployment adapter not yet implemented");
  }

  async teardownPreview(_deploymentRef: string): Promise<void> {
    throw new Error("AWS Worker teardown adapter not yet implemented");
  }
}