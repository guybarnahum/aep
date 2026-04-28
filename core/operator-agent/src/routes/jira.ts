import { getTaskStore } from "@aep/operator-agent/lib/store-factory";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";
import {
  ingestJiraComment,
  ingestJiraStatusSignal,
  syncJiraProjection,
} from "../adapters/jira-mirroring";

type JiraProjectionRequest = {
  threadId?: string;
  externalTicketId?: string;
  projectKey?: string;
};

type JiraCommentRequest = {
  externalTicketId?: string;
  externalCommentId?: string;
  body?: string;
  externalAuthorId?: string;
  receivedAt?: string;
};

type JiraStatusSignalRequest = {
  externalTicketId?: string;
  externalStatus?: string;
  externalEventId?: string;
  receivedAt?: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function handleJiraProjection(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json({ ok: false, error: "Missing operator-agent environment" }, { status: 500 });
  }

  let body: JiraProjectionRequest;
  try {
    body = (await request.json()) as JiraProjectionRequest;
  } catch {
    return Response.json({ ok: false, error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (
    !isNonEmptyString(body.threadId) ||
    !isNonEmptyString(body.externalTicketId) ||
    !isNonEmptyString(body.projectKey)
  ) {
    return Response.json(
      { ok: false, error: "threadId, externalTicketId, and projectKey are required" },
      { status: 400 },
    );
  }

  const store = getTaskStore(env);

  try {
    await syncJiraProjection(store, {
      threadId: body.threadId,
      externalTicketId: body.externalTicketId,
      projectKey: body.projectKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message === "thread_not_found") {
      return Response.json({ ok: false, error: "thread_not_found" }, { status: 404 });
    }

    if (message === "external_ticket_mapped_to_other_thread") {
      return Response.json(
        { ok: false, error: "external_ticket_mapped_to_other_thread" },
        { status: 409 },
      );
    }

    throw error;
  }

  return Response.json({ ok: true }, { status: 200 });
}

export async function handleJiraComment(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json({ ok: false, error: "Missing operator-agent environment" }, { status: 500 });
  }

  let body: JiraCommentRequest;
  try {
    body = (await request.json()) as JiraCommentRequest;
  } catch {
    return Response.json({ ok: false, error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (
    !isNonEmptyString(body.externalTicketId) ||
    !isNonEmptyString(body.externalCommentId) ||
    !isNonEmptyString(body.body) ||
    !isNonEmptyString(body.receivedAt)
  ) {
    return Response.json(
      {
        ok: false,
        error: "externalTicketId, externalCommentId, body, and receivedAt are required",
      },
      { status: 400 },
    );
  }

  const store = getTaskStore(env);

  try {
    const result = await ingestJiraComment(store, {
      externalTicketId: body.externalTicketId,
      externalCommentId: body.externalCommentId,
      body: body.body,
      externalAuthorId: body.externalAuthorId,
      receivedAt: body.receivedAt,
    });

    return Response.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message === "ticket_not_mapped") {
      return Response.json({ ok: false, error: "ticket_not_mapped" }, { status: 404 });
    }

    if (message === "thread_not_found") {
      return Response.json({ ok: false, error: "thread_not_found" }, { status: 404 });
    }

    throw error;
  }
}

export async function handleJiraStatusSignal(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json({ ok: false, error: "Missing operator-agent environment" }, { status: 500 });
  }

  let body: JiraStatusSignalRequest;
  try {
    body = (await request.json()) as JiraStatusSignalRequest;
  } catch {
    return Response.json({ ok: false, error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (
    !isNonEmptyString(body.externalTicketId) ||
    !isNonEmptyString(body.externalStatus) ||
    !isNonEmptyString(body.externalEventId) ||
    !isNonEmptyString(body.receivedAt)
  ) {
    return Response.json(
      {
        ok: false,
        error: "externalTicketId, externalStatus, externalEventId, and receivedAt are required",
      },
      { status: 400 },
    );
  }

  const store = getTaskStore(env);

  try {
    const result = await ingestJiraStatusSignal(store, {
      externalTicketId: body.externalTicketId,
      externalStatus: body.externalStatus,
      externalEventId: body.externalEventId,
      receivedAt: body.receivedAt,
    });

    return Response.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message === "ticket_not_mapped") {
      return Response.json({ ok: false, error: "ticket_not_mapped" }, { status: 404 });
    }

    if (message === "thread_not_found") {
      return Response.json({ ok: false, error: "thread_not_found" }, { status: 404 });
    }

    throw error;
  }
}
