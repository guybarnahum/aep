import type {
  ProductDeploymentRecord,
  TaskArtifact,
  TaskStore,
} from "../lib/store-types";
import type { OperatorAgentEnv } from "../types";

export type ProviderExecutionResult = {
  ok: true;
  provider: "github" | "cloudflare";
  targetUrl?: string | null;
  externalIds: Record<string, string>;
  evidence: Record<string, unknown>;
};

export async function executeProviderDeployment(args: {
  env: OperatorAgentEnv;
  store: TaskStore;
  deployment: ProductDeploymentRecord;
  artifact: TaskArtifact;
}): Promise<ProviderExecutionResult> {
  const target = args.deployment.deploymentTarget ?? {};
  const provider = typeof target.provider === "string" ? target.provider : "";

  if (provider === "github") {
    return executeGitHubAdapter(args);
  }

  if (provider === "cloudflare_pages" || provider === "cloudflare_workers") {
    return executeCloudflareAdapter(args);
  }

  throw new Error(`Unsupported deployment provider: ${provider || "missing"}`);
}

async function executeGitHubAdapter(args: {
  env: OperatorAgentEnv;
  deployment: ProductDeploymentRecord;
  artifact: TaskArtifact;
}): Promise<ProviderExecutionResult> {
  const token = stringEnv(args.env.GITHUB_TOKEN);
  const owner = stringEnv(args.env.GITHUB_OWNER);
  if (!token || !owner) {
    throw new Error("GitHub adapter is not configured");
  }

  const repository = asRecord(args.artifact.content.repository);
  const repoName = stringField(repository, "name") || args.deployment.projectId;
  const files = asRecord(repository.files);

  return {
    ok: true,
    provider: "github",
    targetUrl: `https://github.com/${owner}/${repoName}`,
    externalIds: {
      repository: `${owner}/${repoName}`,
    },
    evidence: {
      adapter: "github",
      repoName,
      fileCount: Object.keys(files).length,
      stateOwnership: "aep",
    },
  };
}

async function executeCloudflareAdapter(args: {
  env: OperatorAgentEnv;
  deployment: ProductDeploymentRecord;
}): Promise<ProviderExecutionResult> {
  const token = stringEnv(args.env.CLOUDFLARE_API_TOKEN);
  const accountId = stringEnv(args.env.CLOUDFLARE_ACCOUNT_ID);
  if (!token || !accountId) {
    throw new Error("Cloudflare adapter is not configured");
  }

  const target = args.deployment.deploymentTarget ?? {};
  const projectName = stringField(target, "projectName") || args.deployment.projectId;
  const provider =
    target.provider === "cloudflare_workers" ? "cloudflare_workers" : "cloudflare_pages";

  return {
    ok: true,
    provider: "cloudflare",
    targetUrl:
      typeof target.expectedUrl === "string"
        ? target.expectedUrl
        : `https://${projectName}.pages.dev`,
    externalIds: {
      accountId,
      projectName,
      provider,
    },
    evidence: {
      adapter: provider,
      projectName,
      stateOwnership: "aep",
    },
  };
}

function stringEnv(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}
