import { execSync } from "child_process";
import { DEFAULT_PROVIDER } from "@aep/shared/index";
import type { DeploymentAdapter, DeployArgs, DeployResult } from "@aep/deployment-engine/types";

export interface NodeWranglerDeployInput {
  serviceName: string;
  workingDir: string;
  envId: string;
}

export class CloudflareNodeDeploymentAdapter implements DeploymentAdapter {
  constructor(
    private readonly options: {
      workingDir?: string;
    } = {},
  ) {}

  async deployPreview(args: DeployArgs): Promise<DeployResult> {
    if (args.provider !== DEFAULT_PROVIDER) {
      throw new Error(
        `CloudflareNodeDeploymentAdapter only supports provider=${DEFAULT_PROVIDER}. Received provider=${args.provider}`,
      );
    }

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
        provider: args.provider,
        deploymentRef: deploymentName,
        previewUrl: url,
      };
    } catch (err: any) {
      console.error("[deploy error]", err?.stdout?.toString?.() ?? err);
      throw new Error("Deployment failed");
    }
  }

  async teardownPreview(deploymentRef: string): Promise<void> {
    console.log(`[teardown] deleting ${deploymentRef}`);

    const cmd = [
      "npx wrangler delete",
      `--name ${deploymentRef}`,
      "--force",
    ].join(" ");

    try {
      const output = execSync(cmd, {
        stdio: "pipe",
      }).toString();

      console.log("[teardown output]", output);
    } catch (err: any) {
      console.error("[teardown error]", err?.stdout?.toString?.() ?? err);
      throw new Error(`Teardown failed for ${deploymentRef}`);
    }
  }
}