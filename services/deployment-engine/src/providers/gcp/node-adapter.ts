import type { DeploymentAdapter, DeployArgs, DeployResult } from "../../types";

export class GcpNodeDeploymentAdapter implements DeploymentAdapter {
  async deployPreview(_args: DeployArgs): Promise<DeployResult> {
    throw new Error("GCP deployment adapter not yet implemented");
  }

  async teardownPreview(_deploymentRef: string): Promise<void> {
    throw new Error("GCP teardown adapter not yet implemented");
  }
}