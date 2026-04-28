import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";
import { newId } from "@aep/shared";
import {
  getExternalSurfaceContract,
  parseExternalSurfaceKind,
} from "../product/external-surface-contracts";

type CustomerIntakeBody = {
  companyId?: unknown;
  title?: unknown;
  description?: unknown;
  requestedBy?: unknown;
  externalSurfaceKind?: unknown;
  productSurface?: unknown;
  sourceUrl?: unknown;
  idempotencyKey?: unknown;
  customerContact?: unknown;
  publicDataPolicy?: unknown;
};

function jsonError(message: string, status = 400, details?: unknown): Response {
  return Response.json({ ok: false, error: message, details }, { status });
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function handleCreateCustomerIntake(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return jsonError("Missing operator-agent environment", 500);
  }

  let body: CustomerIntakeBody;
  try {
    body = (await request.json()) as CustomerIntakeBody;
  } catch {
    return jsonError("Invalid JSON body");
  }

  const companyId = stringOrEmpty(body.companyId) || "company_internal_aep";
  const title = stringOrEmpty(body.title);
  const description = stringOrEmpty(body.description);
  const requestedBy = stringOrEmpty(body.requestedBy) || "external_customer";
  const sourceUrl = stringOrEmpty(body.sourceUrl);
  const idempotencyKey = stringOrEmpty(body.idempotencyKey);
  const externalSurfaceKind = parseExternalSurfaceKind(body.externalSurfaceKind);

  if (!title) {
    return jsonError("title is required");
  }

  if (!externalSurfaceKind) {
    return jsonError(
      `Unsupported externalSurfaceKind: ${String(body.externalSurfaceKind)}`,
    );
  }

  const contract = getExternalSurfaceContract(externalSurfaceKind);
  if (!contract.allowedActions.includes("submit_intake")) {
    return jsonError(`${externalSurfaceKind} cannot submit intake`);
  }

  if (body.productSurface !== contract.productSurface) {
    return jsonError(
      `${externalSurfaceKind} intake must use productSurface ${contract.productSurface}`,
    );
  }

  if (!sourceUrl) {
    return jsonError("sourceUrl is required for customer intake provenance");
  }

  const customerContact = asRecord(body.customerContact);
  const publicDataPolicy = asRecord(body.publicDataPolicy);

  if (!publicDataPolicy) {
    return jsonError("publicDataPolicy is required");
  }

  if (
    publicDataPolicy.privateCognitionExposureAllowed === true ||
    publicDataPolicy.promptInternalsExposed === true ||
    publicDataPolicy.exposesPrivateCognition === true
  ) {
    return jsonError(
      "Customer intake surfaces must not expose private cognition or prompt internals",
    );
  }

  const store = getTaskStore(env);

  if (idempotencyKey) {
    const existing = await store.listIntakeRequests({
      companyId,
      idempotencyKey,
      limit: 1,
    });
    if (existing[0]) {
      return Response.json({
        ok: true,
        intake: existing[0],
        idempotentReplay: true,
      });
    }
  }

  const now = new Date().toISOString();
  const intake = {
    id: newId("intake"),
    companyId,
    title,
    description: description || null,
    requestedBy,
    source: "external_surface",
    externalSurfaceKind,
    productSurface: contract.productSurface,
    sourceUrl,
    idempotencyKey: idempotencyKey || null,
    customerContact,
    status: "submitted" as const,
    createdAt: now,
  };

  await store.createIntakeRequest(intake);

  const threadId = newId("thread");
  const messageId = newId("message");

  await store.createMessageThread({
    id: threadId,
    companyId,
    topic: `Customer intake submitted: ${title}`,
    visibility: "org",
  });

  const message = await store.createMessage({
    id: messageId,
    threadId,
    companyId,
    senderEmployeeId: requestedBy,
    type: "coordination",
    status: "delivered",
    source: "system",
    subject: "Customer intake submitted",
    body:
      "A customer-facing external surface submitted a canonical intake request. " +
      "No project, task, approval, deployment, employee, or staffing state was mutated directly.",
    payload: {
      kind: "customer_intake_submitted",
      intakeId: intake.id,
      externalSurfaceKind,
      productSurface: contract.productSurface,
      sourceUrl,
      idempotencyKey: idempotencyKey || null,
    },
    requiresResponse: false,
  });

  return Response.json(
    { ok: true, intake, threadId, messageId: message.id },
    { status: 201 },
  );
}
