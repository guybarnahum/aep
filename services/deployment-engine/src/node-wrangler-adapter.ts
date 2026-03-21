import { execSync } from "child_process";
import type { DeploymentAdapter, DeployArgs, DeployResult } from "./types";

export interface NodeWranglerDeployInput {
  serviceName: string;
  workingDir: string;
  envId: string;
}

export class NodeWranglerAdapter implements DeploymentAdapter {
  constructor(
    private readonly options: {
      workingDir?: string;
    } = {},
  ) {}

  async deployPreview(args: DeployArgs): Promise<DeployResult> {
    const input: NodeWranglerDeployInput = {
      serviceName: args.serviceName,
      workingDir: this.options.workingDir ?? "examples/sample-worker",
      envId: args.workflowRunId,
    };

    const { serviceName, workingDir, envId } = input;
    const deploymentName = `${serviceName}-${envId}`;

    console.log(`[deploy] deploying ${deploymentName}`);

    const cmd = [
      "npx wrangler deploy",
      `--name ${deploymentName}`,
      `--cwd ${workingDir}`,
    ].join(" ");

    try {
      const output = execSync(cmd, {
        stdio: "pipe",
      }).toString();

      console.log("[deploy output]", output);

      const urlMatch = output.match(/https:\/\/[^\s]+/);
      if (!urlMatch) {
        throw new Error("Could not parse deployed URL from Wrangler output");
      }

      const url = urlMatch[0];

      return {
        provider: "cloudflare",
        deploymentRef: deploymentName,
        previewUrl: url,
      };
    } catch (err: any) {
      console.error("[deploy error]", err?.stdout?.toString?.() ?? err);
      throw new Error("Deployment failed");
    }
  }

  async teardownPreview(deploymentRef: string): Promise<void> {
    console.log(`[teardown] not yet implemented for ${deploymentRef}`);
  }
}