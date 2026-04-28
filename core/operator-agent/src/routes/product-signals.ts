import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";
import { newId } from "@aep/shared";
import {
  classifyProductSignal,
  isProductSignalClassification,
  isProductSignalSeverity,
  isProductSignalSource,
} from "../product/product-signal-contracts";

type ProductSignalBody = {
  companyId?: unknown;
  projectId?: unknown;
  source?: unknown;
  severity?: unknown;
  classification?: unknown;
  title?: unknown;
  body?: unknown;
  sourceUrl?: unknown;
  externalSignalId?: unknown;
  receivedAt?: unknown;
};

function jsonError(message: string, status = 400): Response {
  return Response.json({ ok: false, error: message }, { status });
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function handleIngestProductSignal(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!env) return jsonError("Missing operator-agent environment", 500);

  let body: ProductSignalBody;
  try {
    body = (await request.json()) as ProductSignalBody;
  } catch {
    return jsonError("Invalid JSON body");
  }

  if (!isProductSignalSource(body.source)) return jsonError("Unsupported product signal source");
  if (!isProductSignalSeverity(body.severity)) return jsonError("Unsupported product signal severity");
  if (
    typeof body.classification !== "undefined" &&
    !isProductSignalClassification(body.classification)
  ) {
    return jsonError("Unsupported product signal classification");
  }

  const companyId = stringField(body.companyId) || "company_internal_aep";
  const title = stringField(body.title);
  const bodyText = stringField(body.body);
  const projectId = stringField(body.projectId) || undefined;

  if (!title || !bodyText) {
    return jsonError("title and body are required");
  }

  const decision = classifyProductSignal({
    source: body.source,
    severity: body.severity,
    classification: isProductSignalClassification(body.classification)
      ? body.classification
      : undefined,
  });

  const store = getTaskStore(env);
  const now = new Date().toISOString();

  if (decision.route === "intake") {
    const intakeId = newId("intake");
    await store.createIntakeRequest({
      id: intakeId,
      companyId,
      title,
      description: bodyText,
      requestedBy: `product_signal_${body.source}`,
      source: "product_signal",
      productSurface: null,
      externalSurfaceKind: null,
      sourceUrl: stringField(body.sourceUrl) || null,
      idempotencyKey: stringField(body.externalSignalId) || null,
      customerContact: {
        source: body.source,
        severity: body.severity,
        classification: body.classification ?? "needs_triage",
        projectId,
        receivedAt: stringField(body.receivedAt) || now,
        routeReason: decision.reason,
      },
      status: "submitted",
      createdAt: now,
    });

    return Response.json({
      ok: true,
      route: "intake",
      intakeId,
      reason: decision.reason,
    });
  }

  const threadId = newId("thr");
  await store.createMessageThread({
    id: threadId,
    companyId,
    topic: `Product signal: ${title}`,
    createdByEmployeeId: `product_signal_${body.source}`,
    visibility: "org",
  });

  const message = await store.createMessage({
    id: newId("msg"),
    threadId,
    companyId,
    senderEmployeeId: `product_signal_${body.source}`,
    receiverTeamId: "team_web_product",
    type: "coordination",
    status: "delivered",
    source: "system",
    subject: title,
    body: bodyText,
    payload: {
      kind: "product_signal",
      source: body.source,
      severity: body.severity,
      classification: body.classification ?? "needs_triage",
      projectId,
      sourceUrl: stringField(body.sourceUrl) || null,
      externalSignalId: stringField(body.externalSignalId) || null,
      receivedAt: stringField(body.receivedAt) || now,
      routeReason: decision.reason,
      directTaskCreationAllowed: false,
    },
    requiresResponse: false,
  });

  return Response.json({
    ok: true,
    route: "thread",
    threadId,
    messageId: message.id,
    reason: decision.reason,
  });
}
