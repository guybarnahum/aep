import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DeploymentAdapter, DeployArgs, DeployResult } from "@aep/deployment-engine/types";

type AwsCliJson = Record<string, unknown>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function sanitizeNamePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildFunctionName(serviceName: string, workflowRunId: string): string {
  const base = `${sanitizeNamePart(serviceName)}-${sanitizeNamePart(workflowRunId)}`;
  return base.slice(0, 64);
}

export class AwsNodeDeploymentAdapter implements DeploymentAdapter {
  constructor(
    private readonly options: {
      workingDir?: string;
      region?: string;
    } = {},
  ) {}

  private getRegion(): string {
    return this.options.region ?? getRequiredEnv("AWS_REGION");
  }

  private getExecutionRoleArn(): string {
    return getRequiredEnv("AWS_LAMBDA_EXECUTION_ROLE_ARN");
  }

  private execAws(args: string[]): string {
    const region = this.getRegion();

    try {
      return execFileSync("aws", [...args, "--region", region], {
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf-8",
        env: process.env,
      });
    } catch (error: any) {
      const stderr = error?.stderr?.toString?.() ?? "";
      const stdout = error?.stdout?.toString?.() ?? "";
      const detail = [stdout, stderr].filter(Boolean).join("\n").trim();
      throw new Error(`AWS CLI command failed: aws ${args.join(" ")}${detail ? `\n${detail}` : ""}`);
    }
  }

  private execAwsJson(args: string[]): AwsCliJson {
    const raw = this.execAws([...args, "--output", "json"]).trim();
    if (!raw) {
      return {};
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Failed to parse AWS CLI JSON response for: aws ${args.join(" ")}`);
    }

    if (!isObject(parsed)) {
      throw new Error(`Unexpected non-object AWS CLI JSON response for: aws ${args.join(" ")}`);
    }

    return parsed;
  }

  private packageLambdaArtifact(workingDir: string): string {
    const sourcePath = join(workingDir, "index.mjs");
    const source = readFileSync(sourcePath, "utf-8");

    const tempDir = mkdtempSync(join(tmpdir(), "aep-aws-lambda-"));
    const tempSourcePath = join(tempDir, "index.mjs");
    const zipPath = join(tempDir, "function.zip");

    writeFileSync(tempSourcePath, source, "utf-8");

    try {
      execFileSync("zip", ["-j", zipPath, tempSourcePath], {
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf-8",
      });
    } catch (error: any) {
      const stderr = error?.stderr?.toString?.() ?? "";
      const stdout = error?.stdout?.toString?.() ?? "";
      const detail = [stdout, stderr].filter(Boolean).join("\n").trim();
      rmSync(tempDir, { recursive: true, force: true });
      throw new Error(`Failed to zip AWS Lambda artifact${detail ? `\n${detail}` : ""}`);
    }

    return zipPath;
  }

  private ensureFunctionUrl(functionName: string): string {
    try {
      const existing = this.execAwsJson([
        "lambda",
        "get-function-url-config",
        "--function-name",
        functionName,
      ]);

      const url = existing["FunctionUrl"];
      if (typeof url === "string" && url.length > 0) {
        return url;
      }
    } catch {
      // Fall through to create.
    }

    const created = this.execAwsJson([
      "lambda",
      "create-function-url-config",
      "--function-name",
      functionName,
      "--auth-type",
      "NONE",
      "--cors",
      "{}",
    ]);

    const url = created["FunctionUrl"];
    if (typeof url !== "string" || !url) {
      throw new Error(`AWS create-function-url-config did not return FunctionUrl for ${functionName}`);
    }

    try {
      this.execAws([
        "lambda",
        "add-permission",
        "--function-name",
        functionName,
        "--statement-id",
        "function-url-public-access",
        "--action",
        "lambda:InvokeFunctionUrl",
        "--principal",
        "*",
        "--function-url-auth-type",
        "NONE",
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("ResourceConflictException")) {
        throw error;
      }
    }

    return url;
  }

  async deployPreview(args: DeployArgs): Promise<DeployResult> {
    if (args.provider !== "aws") {
      throw new Error(
        `AwsNodeDeploymentAdapter only supports provider=aws. Received provider=${args.provider}`,
      );
    }

    const workingDir = this.options.workingDir ?? "examples/aws-lambda";
    const functionName = buildFunctionName(args.serviceName, args.workflowRunId);
    const roleArn = this.getExecutionRoleArn();
    const zipPath = this.packageLambdaArtifact(workingDir);

    console.log(`[aws deploy] creating function ${functionName}`);

    try {
      this.execAwsJson([
        "lambda",
        "create-function",
        "--function-name",
        functionName,
        "--runtime",
        "nodejs20.x",
        "--handler",
        "index.handler",
        "--role",
        roleArn,
        "--architectures",
        "x86_64",
        "--timeout",
        "10",
        "--memory-size",
        "128",
        "--zip-file",
        `fileb://${zipPath}`,
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("ResourceConflictException")) {
        rmSync(zipPath, { force: true });
        throw error;
      }

      throw new Error(
        `AWS Lambda function ${functionName} already exists. This should not happen for a unique workflow run id.`,
      );
    }

    try {
      this.execAws([
        "lambda",
        "wait",
        "function-active-v2",
        "--function-name",
        functionName,
      ]);

      const functionUrl = this.ensureFunctionUrl(functionName);

      return {
        provider: "aws",
        deployment_ref: functionName,
        preview_url: functionUrl,
      };
    } finally {
      rmSync(zipPath, { force: true });
      rmSync(join(zipPath, ".."), { recursive: true, force: true });
    }
  }

  async teardownPreview(deploymentRef: string): Promise<void> {
    console.log(`[aws teardown] deleting function ${deploymentRef}`);

    try {
      this.execAws([
        "lambda",
        "delete-function-url-config",
        "--function-name",
        deploymentRef,
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        !message.includes("ResourceNotFoundException") &&
        !message.includes("404")
      ) {
        throw error;
      }
    }

    try {
      this.execAws([
        "lambda",
        "remove-permission",
        "--function-name",
        deploymentRef,
        "--statement-id",
        "function-url-public-access",
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        !message.includes("ResourceNotFoundException") &&
        !message.includes("404")
      ) {
        throw error;
      }
    }

    try {
      this.execAws([
        "lambda",
        "delete-function",
        "--function-name",
        deploymentRef,
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes("ResourceNotFoundException") ||
        message.includes("404")
      ) {
        return;
      }
      throw new Error(`AWS teardown failed for ${deploymentRef}: ${message}`);
    }
  }
}