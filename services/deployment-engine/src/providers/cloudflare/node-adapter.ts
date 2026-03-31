import { execFileSync } from "node:child_process";
import { DEFAULT_PROVIDER } from "@aep/shared";
import type {
  DeploymentAdapter,
  DeployArgs,
  DeployResult,
} from "@aep/deployment-engine/types";

export interface NodeWranglerDeployInput {
  serviceName: string;
  workingDir: string;
  envId: string;
}

function combineOutput(stdout: unknown, stderr: unknown): string {
  const out = typeof stdout === "string" ? stdout : stdout?.toString?.() ?? "";
  const err = typeof stderr === "string" ? stderr : stderr?.toString?.() ?? "";
  return [out, err].filter(Boolean).join("\n").trim();
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

    try {
      const stdout = execFileSync(
        "npx",
        ["wrangler", "deploy", "--name", deploymentName],
        {
          cwd: workingDir,
          stdio: ["ignore", "pipe", "pipe"],
          encoding: "utf-8",
          env: process.env,
        },
      );

      const combined = combineOutput(stdout, "");
      console.log("[deploy output]", combined);

      const urlMatch = combined.match(/https:\/\/[^\s]+/);
      if (!urlMatch) {
        throw new Error(
          `Could not parse deployed URL from Wrangler output.\n${combined}`,
        );
      }

      const url = urlMatch[0];

      return {
        provider: args.provider,
        deploymentRef: deploymentName,
        previewUrl: url,
      };
    } catch (error: any) {
      const detail = combineOutput(error?.stdout, error?.stderr);

      console.error("[deploy error]", detail || error);

      throw new Error(
        `Cloudflare deployment failed for ${deploymentName}${
          detail ? `\n${detail}` : ""
        }`,
      );
    }
  }

  async teardownPreview(deploymentRef: string): Promise<void> {
    console.log(`[teardown] deleting ${deploymentRef}`);

    try {
      const stdout = execFileSync(
        "npx",
        ["wrangler", "delete", "--name", deploymentRef, "--force"],
        {
          stdio: ["ignore", "pipe", "pipe"],
          encoding: "utf-8",
          env: process.env,
        },
      );

      console.log("[teardown output]", stdout);
    } catch (error: any) {
      const detail = combineOutput(error?.stdout, error?.stderr);

      console.error("[teardown error]", detail || error);

      throw new Error(
        `Teardown failed for ${deploymentRef}${detail ? `\n${detail}` : ""}`,
      );
    }
  }
}