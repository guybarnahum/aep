import { getApprovalStore, getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type {
  ProductDeploymentRecord,
  ProductDeploymentStatus,
  TaskArtifact,
} from "@aep/operator-agent/lib/store-types";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";
import { newId } from "@aep/shared";
import { executeProviderDeployment } from "../product/provider-adapters";

const STATUSES: ProductDeploymentStatus[] = [
  "requested",
  "approved",
  "in_progress",
  "deployed",
  "failed",
  "canceled",
];

type CreateDeploymentBody = {
  sourceArtifactId?: unknown;
  requestedByEmployeeId?: unknown;
  environment?: unknown;
  approvalId?: unknown;
};

type UpdateDeploymentStatusBody = {
  status?: unknown;
  approvalId?: unknown;
  targetUrl?: unknown;
};

type ExecuteDeploymentBody = {
  executedByEmployeeId?: unknown;
};

function jsonError(message: string, status = 400, details?: unknown): Response {
  return Response.json({ ok: false, error: message, details }, { status });
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseLimit(raw: string | null, fallback = 50): number {
  const parsed = Number.parseInt(raw ?? `${fallback}`, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 200);
}

function parseStatus(value: string | null): ProductDeploymentStatus | undefined {
  return value && STATUSES.includes(value as ProductDeploymentStatus)
    ? (value as ProductDeploymentStatus)
    : undefined;
}

async function requireApprovedDeploymentApproval(args: {
  env: OperatorAgentEnv;
  approvalId: string | null;
}): Promise<Response | null> {
  if (!args.approvalId) {
    return jsonError("external_safe deployments require approvalId");
  }

  const approval = await getApprovalStore(args.env).get(args.approvalId);
  if (!approval) {
    return jsonError("approvalId does not reference an existing approval", 404, {
      approvalId: args.approvalId,
    });
  }

  if (approval.status !== "approved") {
    return jsonError("external_safe deployments require an approved approval", 409, {
      approvalId: args.approvalId,
      status: approval.status,
    });
  }

  return null;
}

function requireDeploymentCandidate(artifact: TaskArtifact): Response | null {
  if (artifact.content.deployableArtifactKind !== "deployment_candidate") {
    return jsonError(
      "Only deployment_candidate artifacts can create deployment records",
      400,
      { artifactId: artifact.id },
    );
  }

  if (artifact.content.state !== "ready_for_deployment") {
    return jsonError(
      "Deployment candidate artifact must be ready_for_deployment",
      409,
      { artifactId: artifact.id, state: artifact.content.state ?? null },
    );
  }

  if (artifact.content.stateOwnership !== "aep") {
    return jsonError("Deployment candidate must declare stateOwnership as aep");
  }

  return null;
}

export async function handleCreateProductDeployment(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  if (!env) return jsonError("Missing operator-agent environment", 500);

  let body: CreateDeploymentBody;
  try {
    body = (await request.json()) as CreateDeploymentBody;
  } catch {
    return jsonError("Invalid JSON body");
  }

  const sourceArtifactId = stringOrEmpty(body.sourceArtifactId);
  const requestedByEmployeeId = stringOrEmpty(body.requestedByEmployeeId);
  const environment = stringOrEmpty(body.environment);
  const approvalId = stringOrEmpty(body.approvalId) || null;

  if (!sourceArtifactId || !requestedByEmployeeId || !environment) {
    return jsonError(
      "sourceArtifactId, requestedByEmployeeId, and environment are required",
    );
  }

  const store = getTaskStore(env);
  const artifact = await store.getArtifact(sourceArtifactId);
  if (!artifact) return jsonError("Artifact not found", 404);

  const candidateError = requireDeploymentCandidate(artifact);
  if (candidateError) return candidateError;

  const projectId = stringOrEmpty(artifact.content.projectId);
  const externalVisibility: ProductDeploymentRecord["externalVisibility"] =
    artifact.content.externalVisibility === "external_safe"
      ? "external_safe"
      : "internal_only";

  if (!projectId) {
    return jsonError("Deployment candidate artifact must include projectId");
  }

  if (externalVisibility === "external_safe" && !approvalId) {
    return jsonError(
      "external_safe deployments require approvalId before deployment record creation",
    );
  }

  if (externalVisibility === "external_safe") {
    const approvalError = await requireApprovedDeploymentApproval({
      env,
      approvalId,
    });
    if (approvalError) return approvalError;
  }

  const now = new Date().toISOString();
  const deployment = {
    id: newId("deploy"),
    companyId: artifact.companyId,
    projectId,
    sourceTaskId: artifact.taskId,
    sourceArtifactId: artifact.id,
    requestedByEmployeeId,
    environment,
    targetUrl: null,
    externalVisibility,
    status: "requested" as const,
    approvalId,
    deploymentTarget:
      typeof artifact.content.deploymentTarget === "object" &&
      artifact.content.deploymentTarget
        ? (artifact.content.deploymentTarget as Record<string, unknown>)
        : {},
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    deployedAt: null,
    failedAt: null,
    canceledAt: null,
  };

  await store.createProductDeployment(deployment);

  const threadId = newId("thread");
  const messageId = newId("message");

  await store.createMessageThread({
    id: threadId,
    companyId: deployment.companyId,
    topic: `Deployment requested: ${projectId}`,
    createdByEmployeeId: requestedByEmployeeId,
    relatedArtifactId: artifact.id,
    visibility: "org",
  });

  const message = await store.createMessage({
    id: messageId,
    threadId,
    companyId: deployment.companyId,
    senderEmployeeId: requestedByEmployeeId,
    type: "coordination",
    status: "delivered",
    source: "system",
    subject: "Product deployment record created",
    body:
      "Created a canonical deployment record from a ready deployment candidate. " +
      "No external deployment has been executed by this route.",
    payload: {
      kind: "product_deployment_record_created",
      deploymentId: deployment.id,
      projectId,
      sourceArtifactId: artifact.id,
      externalVisibility,
      approvalId,
    },
    requiresResponse: false,
  });

  return Response.json(
    { ok: true, deployment, threadId, messageId: message.id },
    { status: 201 },
  );
}

export async function handleListProductDeployments(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  if (!env) return jsonError("Missing operator-agent environment", 500);

  const url = new URL(request.url);
  const statusRaw = url.searchParams.get("status");
  const status = parseStatus(statusRaw);
  if (statusRaw && !status) return jsonError(`Unsupported deployment status: ${statusRaw}`);

  const store = getTaskStore(env);
  const deployments = await store.listProductDeployments({
    companyId: url.searchParams.get("companyId")?.trim() || undefined,
    projectId: url.searchParams.get("projectId")?.trim() || undefined,
    sourceArtifactId: url.searchParams.get("sourceArtifactId")?.trim() || undefined,
    status,
    limit: parseLimit(url.searchParams.get("limit")),
  });

  return Response.json({ ok: true, count: deployments.length, deployments });
}

export async function handleGetProductDeployment(
  request: Request,
  env: OperatorAgentEnv | undefined,
  deploymentId: string,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  if (!env) return jsonError("Missing operator-agent environment", 500);

  const deployment = await getTaskStore(env).getProductDeployment(deploymentId);
  if (!deployment) return jsonError("Deployment not found", 404);

  return Response.json({ ok: true, deployment });
}

export async function handleUpdateProductDeploymentStatus(
  request: Request,
  env: OperatorAgentEnv | undefined,
  deploymentId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  if (!env) return jsonError("Missing operator-agent environment", 500);

  let body: UpdateDeploymentStatusBody;
  try {
    body = (await request.json()) as UpdateDeploymentStatusBody;
  } catch {
    return jsonError("Invalid JSON body");
  }

  const status = parseStatus(stringOrEmpty(body.status));
  if (!status) return jsonError(`Unsupported deployment status: ${String(body.status)}`);

  const store = getTaskStore(env);
  const current = await store.getProductDeployment(deploymentId);
  if (!current) return jsonError("Deployment not found", 404);

  if (
    current.externalVisibility === "external_safe" &&
    ["approved", "in_progress", "deployed"].includes(status) &&
    !current.approvalId &&
    !stringOrEmpty(body.approvalId)
  ) {
    return jsonError("external_safe deployment status changes require approvalId");
  }

  if (
    current.externalVisibility === "external_safe" &&
    ["approved", "in_progress", "deployed"].includes(status)
  ) {
    const approvalError = await requireApprovedDeploymentApproval({
      env,
      approvalId: stringOrEmpty(body.approvalId) || current.approvalId || null,
    });
    if (approvalError) return approvalError;
  }

  const deployment = await store.updateProductDeploymentStatus({
    deploymentId,
    status,
    approvalId: stringOrEmpty(body.approvalId) || null,
    targetUrl: stringOrEmpty(body.targetUrl) || null,
  });

  return Response.json({ ok: true, deployment });
}

export async function handleExecuteProductDeployment(
  request: Request,
  env: OperatorAgentEnv | undefined,
  deploymentId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  if (!env) return jsonError("Missing operator-agent environment", 500);

  let body: ExecuteDeploymentBody;
  try {
    body = (await request.json()) as ExecuteDeploymentBody;
  } catch {
    return jsonError("Invalid JSON body");
  }

  const executedByEmployeeId = stringOrEmpty(body.executedByEmployeeId);
  if (!executedByEmployeeId) {
    return jsonError("executedByEmployeeId is required");
  }

  const store = getTaskStore(env);
  const deployment = await store.getProductDeployment(deploymentId);
  if (!deployment) return jsonError("Deployment not found", 404);

  if (!["approved", "requested"].includes(deployment.status)) {
    return jsonError("Deployment must be requested or approved before provider execution", 409, {
      deploymentId,
      status: deployment.status,
    });
  }

  if (deployment.externalVisibility === "external_safe") {
    const approvalError = await requireApprovedDeploymentApproval({
      env,
      approvalId: deployment.approvalId ?? null,
    });
    if (approvalError) return approvalError;
  }

  const artifact = await store.getArtifact(deployment.sourceArtifactId);
  if (!artifact) return jsonError("Deployment source artifact not found", 404);

  const candidateError = requireDeploymentCandidate(artifact);
  if (candidateError) return candidateError;

  await store.updateProductDeploymentStatus({
    deploymentId,
    status: "in_progress",
    approvalId: deployment.approvalId ?? null,
    targetUrl: deployment.targetUrl ?? null,
  });

  try {
    const result = await executeProviderDeployment({
      env,
      store,
      deployment,
      artifact,
    });

    const updated = await store.updateProductDeploymentStatus({
      deploymentId,
      status: "deployed",
      approvalId: deployment.approvalId ?? null,
      targetUrl: result.targetUrl ?? null,
    });

    const threadId = newId("thread");
    await store.createMessageThread({
      id: threadId,
      companyId: deployment.companyId,
      topic: `Deployment executed: ${deployment.projectId}`,
      createdByEmployeeId: executedByEmployeeId,
      relatedArtifactId: deployment.sourceArtifactId,
      visibility: "org",
    });

    const message = await store.createMessage({
      id: newId("message"),
      threadId,
      companyId: deployment.companyId,
      senderEmployeeId: executedByEmployeeId,
      type: "coordination",
      status: "delivered",
      source: "system",
      subject: "Provider deployment executed",
      body:
        "Provider execution completed and the canonical AEP deployment record was updated. " +
        "Provider state remains evidence only; AEP remains the source of truth.",
      payload: {
        kind: "provider_deployment_executed",
        deploymentId,
        provider: result.provider,
        targetUrl: result.targetUrl ?? null,
        externalIds: result.externalIds,
        evidence: result.evidence,
        stateOwnership: "aep",
      },
      requiresResponse: false,
    });

    return Response.json({
      ok: true,
      deployment: updated,
      provider: result,
      threadId,
      messageId: message.id,
    });
  } catch (error) {
    const failed = await store.updateProductDeploymentStatus({
      deploymentId,
      status: "failed",
      approvalId: deployment.approvalId ?? null,
      targetUrl: deployment.targetUrl ?? null,
    });

    return jsonError(
      error instanceof Error ? error.message : "Provider deployment failed",
      502,
      { deployment: failed },
    );
  }
}
