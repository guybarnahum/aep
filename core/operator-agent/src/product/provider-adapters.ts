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

type ProviderFileMap = Record<string, string>;

export async function executeProviderDeployment(args: {
  env: OperatorAgentEnv;
  store: TaskStore;
  deployment: ProductDeploymentRecord;
  artifact: TaskArtifact;
}): Promise<ProviderExecutionResult> {
  const deployableArtifact = await resolveDeploymentArtifact(args.store, args.artifact);
  const target = args.deployment.deploymentTarget ?? {};
  const provider = typeof target.provider === "string" ? target.provider : "";

  if (provider === "github") {
    return executeGitHubAdapter({
      env: args.env,
      deployment: args.deployment,
      artifact: deployableArtifact,
    });
  }

  if (provider === "cloudflare_pages" || provider === "cloudflare_workers") {
    return executeCloudflareAdapter({
      env: args.env,
      deployment: args.deployment,
      artifact: deployableArtifact,
    });
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
  const files = normalizeProviderFiles(repository.files);

  if (Object.keys(files).length === 0) {
    throw new Error("GitHub adapter requires repository.files");
  }

  const privateRepo =
    typeof repository.private === "boolean" ? repository.private : true;

  const repo = await ensureGitHubRepository({
    token,
    owner,
    repoName,
    privateRepo,
  });

  const committed = await upsertGitHubFiles({
    token,
    owner,
    repoName,
    files,
    message:
      stringField(repository, "commitMessage") ||
      `Deploy AEP artifact ${args.artifact.id}`,
  });

  return {
    ok: true,
    provider: "github",
    targetUrl: `https://github.com/${owner}/${repoName}`,
    externalIds: {
      repository: `${owner}/${repoName}`,
      repositoryId: String(repo.id ?? ""),
      commitSha: committed.commitSha,
    },
    evidence: {
      adapter: "github",
      repoName,
      fileCount: Object.keys(files).length,
      created: repo.created,
      updatedPaths: committed.paths,
      commitSha: committed.commitSha,
      stateOwnership: "aep",
    },
  };
}

async function executeCloudflareAdapter(args: {
  env: OperatorAgentEnv;
  deployment: ProductDeploymentRecord;
  artifact: TaskArtifact;
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

  if (provider === "cloudflare_workers") {
    return executeCloudflareWorkerDeployment({
      token,
      accountId,
      projectName,
      deployment: args.deployment,
      artifact: args.artifact,
      target,
    });
  }

  return executeCloudflarePagesDeployment({
    token,
    accountId,
    projectName,
    deployment: args.deployment,
    artifact: args.artifact,
    target,
  });
}

async function executeCloudflarePagesDeployment(args: {
  token: string;
  accountId: string;
  projectName: string;
  deployment: ProductDeploymentRecord;
  artifact: TaskArtifact;
  target: Record<string, unknown>;
}): Promise<ProviderExecutionResult> {
  await ensureCloudflarePagesProject({
    token: args.token,
    accountId: args.accountId,
    projectName: args.projectName,
    productionBranch: stringField(args.target, "productionBranch") || "main",
  });

  const uploadResult = await createCloudflarePagesDirectUpload({
    token: args.token,
    accountId: args.accountId,
    projectName: args.projectName,
    files: extractWebsiteBundleFiles(args.artifact),
  });

  return {
    ok: true,
    provider: "cloudflare",
    targetUrl:
      typeof args.target.expectedUrl === "string"
        ? args.target.expectedUrl
        : `https://${args.projectName}.pages.dev`,
    externalIds: {
      accountId: args.accountId,
      projectName: args.projectName,
      provider: "cloudflare_pages",
      deploymentId: uploadResult.deploymentId,
    },
    evidence: {
      adapter: "cloudflare_pages",
      projectName: args.projectName,
      fileCount: uploadResult.fileCount,
      deploymentId: uploadResult.deploymentId,
      stateOwnership: "aep",
    },
  };
}

async function executeCloudflareWorkerDeployment(args: {
  token: string;
  accountId: string;
  projectName: string;
  deployment: ProductDeploymentRecord;
  artifact: TaskArtifact;
  target: Record<string, unknown>;
}): Promise<ProviderExecutionResult> {
  const scriptName = stringField(args.target, "scriptName") || args.projectName;
  const script = extractWorkerScript(args.artifact);

  const result = await putCloudflareWorkerScript({
    token: args.token,
    accountId: args.accountId,
    scriptName,
    script,
  });

  return {
    ok: true,
    provider: "cloudflare",
    targetUrl:
      typeof args.target.expectedUrl === "string"
        ? args.target.expectedUrl
        : null,
    externalIds: {
      accountId: args.accountId,
      projectName: args.projectName,
      provider: "cloudflare_workers",
      scriptName,
    },
    evidence: {
      adapter: "cloudflare_workers",
      scriptName,
      etag: result.etag,
      stateOwnership: "aep",
    },
  };
}

async function ensureGitHubRepository(args: {
  token: string;
  owner: string;
  repoName: string;
  privateRepo: boolean;
}): Promise<{ id?: number; created: boolean }> {
  const existing = await githubJson({
    token: args.token,
    method: "GET",
    path: `/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repoName)}`,
    allow404: true,
  });

  if (existing.status !== 404) {
    return { id: numberField(existing.json, "id"), created: false };
  }

  const created = await githubJson({
    token: args.token,
    method: "POST",
    path: "/user/repos",
    body: {
      name: args.repoName,
      private: args.privateRepo,
      auto_init: true,
    },
  });

  return { id: numberField(created.json, "id"), created: true };
}

async function upsertGitHubFiles(args: {
  token: string;
  owner: string;
  repoName: string;
  files: ProviderFileMap;
  message: string;
}): Promise<{ commitSha: string; paths: string[] }> {
  let latestCommitSha = "";
  const paths: string[] = [];

  for (const [path, content] of Object.entries(args.files)) {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const existing = await githubJson({
      token: args.token,
      method: "GET",
      path: `/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repoName)}/contents/${encodedPath}`,
      allow404: true,
    });

    const response = await githubJson({
      token: args.token,
      method: "PUT",
      path: `/repos/${encodeURIComponent(args.owner)}/${encodeURIComponent(args.repoName)}/contents/${encodedPath}`,
      body: {
        message: args.message,
        content: base64Encode(content),
        sha: existing.status === 404 ? undefined : stringField(asRecord(existing.json), "sha"),
      },
    });

    latestCommitSha =
      stringField(asRecord(asRecord(response.json).commit), "sha") || latestCommitSha;
    paths.push(path);
  }

  return { commitSha: latestCommitSha, paths };
}

async function ensureCloudflarePagesProject(args: {
  token: string;
  accountId: string;
  projectName: string;
  productionBranch: string;
}): Promise<void> {
  const existing = await cloudflareJson({
    token: args.token,
    method: "GET",
    path: `/accounts/${args.accountId}/pages/projects/${args.projectName}`,
    allow404: true,
  });

  if (existing.status !== 404) return;

  await cloudflareJson({
    token: args.token,
    method: "POST",
    path: `/accounts/${args.accountId}/pages/projects`,
    body: {
      name: args.projectName,
      production_branch: args.productionBranch,
    },
  });
}

async function createCloudflarePagesDirectUpload(args: {
  token: string;
  accountId: string;
  projectName: string;
  files: ProviderFileMap;
}): Promise<{ deploymentId: string; fileCount: number }> {
  const response = await cloudflareJson({
    token: args.token,
    method: "POST",
    path: `/accounts/${args.accountId}/pages/projects/${args.projectName}/deployments`,
    body: {
      files: Object.fromEntries(
        Object.entries(args.files).map(([path, content]) => [path, base64Encode(content)]),
      ),
    },
  });

  const result = asRecord(asRecord(response.json).result);
  return {
    deploymentId: stringField(result, "id"),
    fileCount: Object.keys(args.files).length,
  };
}

async function putCloudflareWorkerScript(args: {
  token: string;
  accountId: string;
  scriptName: string;
  script: string;
}): Promise<{ etag: string | null }> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${args.accountId}/workers/scripts/${encodeURIComponent(args.scriptName)}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${args.token}`,
      "Content-Type": "application/javascript",
    },
    body: args.script,
  });

  if (!response.ok) {
    throw new Error(`Cloudflare Workers deploy failed: ${response.status} ${await response.text()}`);
  }

  return { etag: response.headers.get("etag") };
}

async function githubJson(args: {
  token: string;
  method: "GET" | "POST" | "PUT";
  path: string;
  body?: Record<string, unknown>;
  allow404?: boolean;
}): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`https://api.github.com${args.path}`, {
    method: args.method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${args.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "aep-operator-agent",
    },
    body: args.body ? JSON.stringify(args.body) : undefined,
  });

  if (response.status === 404 && args.allow404) {
    return { status: 404, json: {} };
  }

  const json = asRecord(await response.json().catch(() => ({})));
  if (!response.ok) {
    throw new Error(`GitHub API failed: ${response.status} ${JSON.stringify(json)}`);
  }

  return { status: response.status, json };
}

async function cloudflareJson(args: {
  token: string;
  method: "GET" | "POST";
  path: string;
  body?: Record<string, unknown>;
  allow404?: boolean;
}): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`https://api.cloudflare.com/client/v4${args.path}`, {
    method: args.method,
    headers: {
      Authorization: `Bearer ${args.token}`,
      "Content-Type": "application/json",
    },
    body: args.body ? JSON.stringify(args.body) : undefined,
  });

  if (response.status === 404 && args.allow404) {
    return { status: 404, json: {} };
  }

  const json = asRecord(await response.json().catch(() => ({})));
  if (!response.ok) {
    throw new Error(`Cloudflare API failed: ${response.status} ${JSON.stringify(json)}`);
  }

  return { status: response.status, json };
}

async function resolveDeploymentArtifact(
  store: TaskStore,
  artifact: TaskArtifact,
): Promise<TaskArtifact> {
  const artifactRef = stringField(asRecord(artifact.content), "artifactRef");
  if (!artifactRef) {
    return artifact;
  }

  const referencedArtifact = await store.getArtifact(artifactRef);
  return referencedArtifact ?? artifact;
}

function normalizeProviderFiles(value: unknown): ProviderFileMap {
  const record = asRecord(value);
  return Object.fromEntries(
    Object.entries(record).flatMap(([path, content]) => {
      const normalizedPath = path.trim();
      return normalizedPath.length > 0 && typeof content === "string"
        ? [[normalizedPath, content]]
        : [];
    }),
  );
}

function extractWebsiteBundleFiles(artifact: TaskArtifact): ProviderFileMap {
  const bundle = asRecord(artifact.content.bundle);
  const files = normalizeProviderFiles(bundle.files);
  if (Object.keys(files).length === 0) {
    throw new Error("Cloudflare Pages adapter requires bundle.files");
  }
  return files;
}

function extractWorkerScript(artifact: TaskArtifact): string {
  const bundle = asRecord(artifact.content.bundle);
  const script =
    stringField(bundle, "workerScript") || stringField(asRecord(artifact.content), "workerScript");
  if (!script) {
    throw new Error("Cloudflare Workers adapter requires workerScript");
  }
  return script;
}

function base64Encode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" ? value : undefined;
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
