import { execSync } from "child_process";

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

            const urlMatch = output.match(/https:\/\/[^\s]+/);
            if (!urlMatch) {
            throw new Error("Could not parse deployed URL from Wrangler output");
            }

            const url = urlMatch[0];

            return {
            deploymentId: deploymentName,
            url,
            };
        } catch (err: any) {
            console.error("[deploy error]", err?.stdout?.toString?.() ?? err);
            throw new Error("Deployment failed");
        }
    }
}