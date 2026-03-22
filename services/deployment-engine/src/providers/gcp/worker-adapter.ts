import type { DeploymentAdapter, DeployArgs, DeployResult } from "../../types";

export class GcpWorkerDeploymentAdapter implements DeploymentAdapter {
  async deployPreview(_args: DeployArgs): Promise<DeployResult> {
    throw new Error("GCP Worker deployment adapter not yet implemented");
  }

  async teardownPreview(_deploymentRef: string): Promise<void> {
    throw new Error("GCP Worker teardown adapter not yet implemented");
  }
}