import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import { newId } from "@aep/shared";
import { TEAM_WEB_PRODUCT } from "@aep/operator-agent/org/teams";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

function jsonError(message: string, status = 400): Response {
  return Response.json({ ok: false, error: message }, { status });
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

  const now = new Date().toISOString();
  const projectId = newId("project");

  await store.createProject({
    id: projectId,
    companyId: intake.companyId,
    intakeRequestId: intake.id,
    title: intake.title,
    description: intake.description ?? null,
    ownerTeamId: TEAM_WEB_PRODUCT,
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
    topic: `Project coordination: ${intake.title}`,
    visibility: "internal",
  });

  const messageId = newId("message");
  const message = await store.createMessage({
    id: messageId,
    threadId,
    companyId: intake.companyId,
    senderEmployeeId: intake.requestedBy,
    type: "coordination",
    status: "delivered",
    source: "system",
    body: `Intake request "${intake.title}" has been converted to project ${projectId}.`,
    payload: { intakeRequestId: intake.id, projectId },
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
