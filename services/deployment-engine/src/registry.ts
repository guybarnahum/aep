import type { Provider } from "../../../packages/shared/src/index";
import type { DeploymentAdapter } from "./types";
import { CloudflareNodeDeploymentAdapter } from "./providers/cloudflare/node-adapter";

interface NodeAdapterOptions {
  workingDir?: string;
}

export function getNodeDeploymentAdapter(
  provider: Provider,
  options: NodeAdapterOptions = {},
): DeploymentAdapter {
  switch (provider) {
    case "cloudflare":
      return new CloudflareNodeDeploymentAdapter(options);
    case "aws":
      throw new Error("AWS deployment adapter not yet implemented");
    case "gcp":
      throw new Error("GCP deployment adapter not yet implemented");
  }
}