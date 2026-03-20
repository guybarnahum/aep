import { execSync } from "child_process";
import path from "path";

export interface DeployInput {
  serviceName: string;
  workingDir: string; // path to worker project
  envId: string;
}

export interface DeployOutput {
  deploymentId: string;
  url: string;
}

export class CloudflareWranglerAdapter {
  deploy(input: DeployInput): DeployOutput {
    const { serviceName, workingDir, envId } = input;

    const deploymentName = `${serviceName}-${envId}`;

    console.log(`[deploy] deploying ${deploymentName}`);

    // ⚠️ assumes wrangler is authenticated locally
    const cmd = `
      npx wrangler deploy \
        --name ${deploymentName} \
        --cwd ${workingDir}
    `;

    try {
      const output = execSync(cmd, {
        stdio: "pipe",
      }).toString();

      console.log("[deploy output]", output);

      // Simple deterministic URL (Cloudflare standard)
      const url = `https://${deploymentName}.workers.dev`;

      return {
        deploymentId: deploymentName,
        url,
      };
    } catch (err: any) {
      console.error("[deploy error]", err?.stdout?.toString());
      throw new Error("Deployment failed");
    }
  }
}