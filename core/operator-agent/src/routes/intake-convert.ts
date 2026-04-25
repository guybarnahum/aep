import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import { newId } from "@aep/shared";
import { TEAM_WEB_PRODUCT, isTeamId } from "@aep/operator-agent/org/teams";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

type ConvertIntakeBody = {
  ownerTeamId?: unknown;
  projectTitle?: unknown;
  projectDescription?: unknown;
  convertedByEmployeeId?: unknown;
  rationale?: unknown;
};

function jsonError(message: string, status = 400): Response {
  return Response.json({ ok: false, error: message }, { status });
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function handleConvertIntakeToProject(
  request: Request,
  env: OperatorAgentEnv | undefined,
  intakeId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return jsonError("Missing operator-agent environment", 500);
  }

  let body: ConvertIntakeBody;
  try {
    body = (await request.json()) as ConvertIntakeBody;
  } catch {
    return jsonError("Invalid JSON body");
  }

  const store = getTaskStore(env);
  const intake = await store.getIntakeRequest(intakeId);

  if (!intake) {
    return jsonError("Intake request not found", 404);
  }

  if (intake.status === "converted") {
    return jsonError("Intake request has already been converted", 409);
  }

  if (intake.status === "rejected") {
    return jsonError("Rejected intake requests cannot be converted", 422);
  }

  const ownerTeamId = stringOrEmpty(body.ownerTeamId) || TEAM_WEB_PRODUCT;
  if (!isTeamId(ownerTeamId)) {
    return jsonError(`Unsupported ownerTeamId: ${ownerTeamId}`);
  }

  const convertedByEmployeeId = stringOrEmpty(body.convertedByEmployeeId);
  if (!convertedByEmployeeId) {
    return jsonError("convertedByEmployeeId is required");
  }

  const projectTitle = stringOrEmpty(body.projectTitle) || intake.title;
  const projectDescription =
    stringOrEmpty(body.projectDescription) ||
    intake.description ||
    `Project converted from intake request ${intake.id}.`;
  const rationale =
    stringOrEmpty(body.rationale) ||
    "PM converted this intake request into a canonical project.";

  const now = new Date().toISOString();
  const projectId = newId("project");

  await store.createProject({
    id: projectId,
    companyId: intake.companyId,
    intakeRequestId: intake.id,
    title: projectTitle,
    description: projectDescription,
    ownerTeamId,
    status: "active",
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    archivedAt: null,
  });

  await store.updateIntakeRequestStatus({ id: intake.id, status: "converted" });

  const threadId = newId("thread");
  await store.createMessageThread({
    id: threadId,
    companyId: intake.companyId,
    topic: `Intake converted: ${intake.title}`,
    createdByEmployeeId: convertedByEmployeeId,
    visibility: "org",
  });

  const messageId = newId("message");
  const message = await store.createMessage({
    id: messageId,
    threadId,
    companyId: intake.companyId,
    senderEmployeeId: convertedByEmployeeId,
    receiverTeamId: ownerTeamId,
    type: "coordination",
    status: "delivered",
    source: "system",
    subject: "Intake converted to project",
    body: rationale,
    payload: {
      kind: "intake_project_conversion",
      intakeRequestId: intake.id,
      projectId,
      ownerTeamId,
    },
    requiresResponse: false,
  });

  const project = await store.getProject(projectId);

  return Response.json(
    {
      ok: true,
      intake: { ...intake, status: "converted" },
      project,
      threadId,
      messageId: message.id,
    },
    { status: 201 },
  );
}
