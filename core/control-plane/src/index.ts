import { emitEvent } from "../../observability/src/index";
import { WorkflowCoordinatorDO } from "../../workflow-engine/src/index";
import type { Env } from "../../types/src/index";
import type { StartWorkflowRequest } from "../../../packages/event-schema/src/index";
import {
  DEFAULT_PROVIDER,
  newId,
  nowIso,
  isProvider,
  sha256Hex,
  timingSafeEqual,
} from "../../../packages/shared/src/index";
import { handleHealthz } from "./routes/healthz";

async function json(request: Request): Promise<unknown> {
  return request.json();
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function parseDeployMode(value: unknown): "sync" | "async" {
  return value === "async" ? "async" : "sync";
}

function parseTeardownMode(value: unknown): "sync" | "async" {
  return value === "sync" ? "sync" : "async";
}

async function verifyCallbackToken(
  storedHash: string,
  providedToken: string | null,
): Promise<boolean> {
  if (!providedToken) {
    return false;
  }

  const providedHash = await sha256Hex(providedToken);
  return timingSafeEqual(storedHash, providedHash);
}

function normalizeTraceEventRow(row: Record<string, unknown>): Record<string, unknown> {
  const payloadJson = row["payload_json"];
  let payload: Record<string, unknown> = {};

  if (typeof payloadJson === "string" && payloadJson.trim() !== "") {
    try {
      const parsed = JSON.parse(payloadJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        payload = parsed as Record<string, unknown>;
      }
    } catch {
      payload = {};
    }
  }

  return {
    id: row["id"],
    trace_id: row["trace_id"],
    workflow_run_id: row["workflow_run_id"],
    step_name: row["step_name"],
    event_type: row["event_type"],
    timestamp: row["timestamp"],
    payload,
  };
}

type DeployJobType = "deploy_preview" | "teardown_preview";

type DeployJobAttemptCallbackBody = {
  status: "running" | "succeeded" | "failed";
  result?: Record<string, unknown>;
  error_message?: string;
};

type DeployPreviewResult = {
  deployment_ref?: string;
  preview_url?: string;
  url?: string;
};

function isAttemptTerminalStatus(status: string): boolean {
  return status === "succeeded" || status === "failed";
}

function isDuplicateAttemptTransition(
  currentStatus: string,
  nextStatus: "running" | "succeeded" | "failed",
): boolean {
  return currentStatus === nextStatus;
}

function isAllowedAttemptTransition(
  currentStatus: string,
  nextStatus: "running" | "succeeded" | "failed",
): boolean {
  if (currentStatus === "queued") {
    return nextStatus === "running" || nextStatus === "succeeded" || nextStatus === "failed";
  }

  if (currentStatus === "running") {
    return nextStatus === "succeeded" || nextStatus === "failed";
  }

  return false;
}

function buildNoopCallbackResponse(args: {
  attemptId: string;
  status: string;
  duplicate?: boolean;
  ignored?: boolean;
  reason?: string;
}): Response {
  return Response.json({
    ok: true,
    attempt_id: args.attemptId,
    status: args.status,
    duplicate: args.duplicate ?? false,
    ignored: args.ignored ?? false,
    reason: args.reason ?? null,
  });
}

function isActiveAttempt(
  job: { active_attempt_no: number | null },
  attempt: { attempt_no: number },
): boolean {
  return job.active_attempt_no === attempt.attempt_no;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/workflow/start") {
      try {
        const body = (await json(request)) as Partial<StartWorkflowRequest>;
        const payload: StartWorkflowRequest = {
          tenant_id: requireString(body.tenant_id, "tenant_id"),
          project_id: requireString(body.project_id, "project_id"),
          repo_url: requireString(body.repo_url, "repo_url"),
          branch: requireString(body.branch, "branch"),
          service_name: requireString(body.service_name, "service_name"),
          provider: isProvider(body.provider) ? body.provider : DEFAULT_PROVIDER,
          deploy_mode: parseDeployMode(body.deploy_mode),
          teardown_mode: parseTeardownMode(body.teardown_mode),
        };

        const workflowRunId = newId("run");
        const traceId = newId("trace");

        await env.DB.prepare(
          `INSERT INTO workflow_runs (id, tenant_id, project_id, service_name, repo_url, branch, status, trace_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            workflowRunId,
            payload.tenant_id,
            payload.project_id,
            payload.service_name,
            payload.repo_url,
            payload.branch,
            "queued",
            traceId,
            nowIso(),
          )
          .run();

        const id = env.WORKFLOW_COORDINATOR.idFromName(workflowRunId);
        const stub = env.WORKFLOW_COORDINATOR.get(id);
        await stub.fetch(
          new Request("https://do/start", {
            method: "POST",
            body: JSON.stringify({
              ...payload,
              workflow_run_id: workflowRunId,
              trace_id: traceId,
            }),
          }),
        );

        return Response.json(
          {
            workflow_run_id: workflowRunId,
            trace_id: traceId,
            status: "queued",
          },
          { status: 202 },
        );
      } catch (error) {
        return badRequest(
          error instanceof Error ? error.message : "Invalid request body",
        );
      }
    }

    if (request.method === "GET" && url.pathname.startsWith("/workflow/")) {
      const workflowRunId = url.pathname.split("/")[2];
      const run = await env.DB.prepare(`SELECT * FROM workflow_runs WHERE id = ?`)
        .bind(workflowRunId)
        .first();
      if (!run) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }
      const steps = await env.DB.prepare(
        `SELECT * FROM workflow_steps WHERE workflow_run_id = ? ORDER BY started_at ASC`,
      )
        .bind(workflowRunId)
        .all();
      return Response.json({ run, steps: steps.results ?? [] });
    }

    if (request.method === "GET" && url.pathname.startsWith("/trace/")) {
      const traceId = url.pathname.split("/")[2];
      const events = await env.DB.prepare(
        `SELECT * FROM events WHERE trace_id = ? ORDER BY timestamp ASC`,
      )
        .bind(traceId)
        .all();

      const normalizedEvents = (events.results ?? []).map((row) =>
        normalizeTraceEventRow(row as Record<string, unknown>),
      );

      return Response.json({ trace_id: traceId, events: normalizedEvents });
    }

    if (request.method === "POST" && url.pathname.match(/^\/workflow\/[^/]+\/cancel$/)) {
      const workflowRunId = url.pathname.split("/")[2];
      const id = env.WORKFLOW_COORDINATOR.idFromName(workflowRunId);
      const stub = env.WORKFLOW_COORDINATOR.get(id);
      await stub.fetch(new Request("https://do/cancel", { method: "POST" }));
      return Response.json({
        workflow_run_id: workflowRunId,
        status: "cancellation_requested",
      });
    }

    if (
      request.method === "POST" &&
      url.pathname.match(/^\/internal\/deploy-job-attempts\/[^/]+\/callback$/)
    ) {
      const attemptId = url.pathname.split("/")[3];
      const authHeader = request.headers.get("authorization");
      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length)
        : null;

      const body = (await json(request)) as DeployJobAttemptCallbackBody;

      const attempt = await env.DB.prepare(
        `SELECT
            dja.id,
            dja.job_id,
            dja.attempt_no,
            dja.status AS attempt_status,
            dja.callback_token_hash,
            dja.result_json AS attempt_result_json,
            dja.error_message AS attempt_error_message,
            dja.superseded_at,

            dj.workflow_run_id,
            dj.step_name,
            dj.job_type,
            dj.provider,
            dj.status AS job_status,
            dj.request_json,
            dj.active_attempt_no,
            dj.terminal_attempt_no,

            wr.trace_id
         FROM deploy_job_attempts dja
         JOIN deploy_jobs dj ON dj.id = dja.job_id
         JOIN workflow_runs wr ON wr.id = dj.workflow_run_id
         WHERE dja.id = ?`,
      )
        .bind(attemptId)
        .first<{
          id: string;
          job_id: string;
          attempt_no: number;
          attempt_status: string;
          callback_token_hash: string;
          attempt_result_json: string | null;
          attempt_error_message: string | null;
          superseded_at: string | null;

          workflow_run_id: string;
          step_name: string;
          job_type: DeployJobType;
          provider: string;
          job_status: string;
          request_json: string;
          active_attempt_no: number | null;
          terminal_attempt_no: number | null;

          trace_id: string;
        }>();

      if (!attempt) {
        return Response.json({ error: "Deploy job attempt not found" }, { status: 404 });
      }

      const ok = await verifyCallbackToken(attempt.callback_token_hash, token);
      if (!ok) {
        return Response.json({ error: "Unauthorized callback" }, { status: 401 });
      }

      const requestJson = JSON.parse(attempt.request_json) as {
        deployment_ref?: string;
        environment_id?: string;
        service_name?: string;
      };

      const deployResult = (body.result ?? {}) as DeployPreviewResult;

      const activeAttempt = isActiveAttempt(
        { active_attempt_no: attempt.active_attempt_no },
        { attempt_no: attempt.attempt_no },
      );

      if (!activeAttempt) {
        return buildNoopCallbackResponse({
          attemptId,
          status: body.status,
          ignored: true,
          reason: "stale_attempt",
        });
      }

      if (isDuplicateAttemptTransition(attempt.attempt_status, body.status)) {
        return buildNoopCallbackResponse({
          attemptId,
          status: body.status,
          duplicate: true,
        });
      }

      if (
        isAttemptTerminalStatus(attempt.attempt_status) ||
        !isAllowedAttemptTransition(attempt.attempt_status, body.status)
      ) {
        return buildNoopCallbackResponse({
          attemptId,
          status: body.status,
          ignored: true,
          reason: "invalid_transition",
        });
      }
      
      if (body.status === "running") {
        const startedAt = nowIso();

        await env.DB.prepare(
          `UPDATE deploy_job_attempts
           SET status = ?, started_at = ?
           WHERE id = ?`,
        )
          .bind("running", startedAt, attemptId)
          .run();

        await env.DB.prepare(
          `UPDATE deploy_jobs
           SET status = ?, last_dispatched_at = COALESCE(last_dispatched_at, ?)
           WHERE id = ?`,
        )
          .bind("running", startedAt, attempt.job_id)
          .run();

        await emitEvent(env.DB, {
          traceId: attempt.trace_id,
          workflowRunId: attempt.workflow_run_id,
          stepName: attempt.step_name as never,
          eventType:
            attempt.job_type === "deploy_preview"
              ? "deploy.job_started"
              : "teardown.job_started",
          payload: {
            job_id: attempt.job_id,
            attempt_id: attemptId,
            attempt_no: attempt.attempt_no,
            job_type: attempt.job_type,
            provider: attempt.provider,
          },
        });

        return Response.json({ ok: true, attempt_id: attemptId, status: body.status });
      }

      if (body.status === "succeeded") {
        const completedAt = nowIso();

        await env.DB.prepare(
          `UPDATE deploy_job_attempts
           SET status = ?, result_json = ?, completed_at = ?
           WHERE id = ?`,
        )
          .bind(
          "succeeded",
          JSON.stringify(body.result ?? {}),
          completedAt,
          attemptId,
        )
        .run();

        await env.DB.prepare(
          `UPDATE deploy_jobs
           SET status = ?, result_json = ?, completed_at = ?, terminal_attempt_no = ?
           WHERE id = ?`,
        )
        .bind(
          "succeeded",
          JSON.stringify(body.result ?? {}),
          completedAt,
          attempt.attempt_no,
          attempt.job_id,
          )
          .run();

        await emitEvent(env.DB, {
          traceId: attempt.trace_id,
          workflowRunId: attempt.workflow_run_id,
          stepName: attempt.step_name as never,
          eventType:
            attempt.job_type === "deploy_preview"
              ? "deploy.job_succeeded"
              : "teardown.job_succeeded",
          payload: {
            job_id: attempt.job_id,
            attempt_id: attemptId,
            attempt_no: attempt.attempt_no,
            job_type: attempt.job_type,
            provider: attempt.provider,
          },
        });

        await env.DB.prepare(
          `UPDATE workflow_steps
           SET status = ?, completed_at = ?, error_message = NULL
           WHERE workflow_run_id = ? AND step_name = ? AND status = ?`,
        )
          .bind(
            "completed",
            completedAt,
            attempt.workflow_run_id,
            attempt.step_name,
            "waiting",
          )
          .run();

        if (attempt.job_type === "deploy_preview") {
          const deploymentRef = deployResult.deployment_ref;
          const previewUrl = deployResult.preview_url ?? deployResult.url;

          if (!deploymentRef) {
            return Response.json(
              { error: "deploy_preview callback missing deployment_ref" },
              { status: 400 },
            );
          }

          if (!previewUrl) {
            return Response.json(
              { error: "deploy_preview callback missing preview_url" },
              { status: 400 },
            );
          }

          let resolvedDeploymentId: string | undefined;

          const existingDeployment = await env.DB.prepare(
            `SELECT id FROM deployments WHERE environment_id = ? LIMIT 1`,
          )
            .bind(requestJson.environment_id ?? null)
            .first<{ id: string }>();

          if (existingDeployment) {
            resolvedDeploymentId = existingDeployment.id;

            await env.DB.prepare(
              `UPDATE deployments
               SET deployment_provider = ?, deployment_ref = ?, url = ?, status = ?
               WHERE id = ?`,
            )
              .bind(
                attempt.provider,
                deploymentRef,
                previewUrl,
                "deployed",
                existingDeployment.id,
              )
              .run();
          } else if (requestJson.environment_id) {
            resolvedDeploymentId = newId("dep");

            await env.DB.prepare(
              `INSERT INTO deployments (
                id,
                environment_id,
                deployment_provider,
                deployment_ref,
                url,
                status,
                created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            )
              .bind(
                resolvedDeploymentId,
                requestJson.environment_id,
                attempt.provider,
                deploymentRef,
                previewUrl,
                "deployed",
                completedAt,
              )
              .run();
          }

          if (requestJson.environment_id) {
            await env.DB.prepare(
              `UPDATE environments
               SET status = ?, preview_url = ?
               WHERE id = ?`,
            )
              .bind("deployed", previewUrl, requestJson.environment_id)
              .run();
          }

          const doId = env.WORKFLOW_COORDINATOR.idFromName(attempt.workflow_run_id);
          const stub = env.WORKFLOW_COORDINATOR.get(doId);

          await stub.fetch(
            new Request("https://do/callback-update", {
              method: "POST",
              body: JSON.stringify({
                deploymentRef,
                previewUrl,
                deploymentId: resolvedDeploymentId,
              }),
            }),
          );
        } else if (attempt.job_type === "teardown_preview") {
          if (requestJson.deployment_ref) {
            await env.DB.prepare(
              `UPDATE deployments
               SET status = ?, destroyed_at = ?
               WHERE deployment_ref = ?`,
            )
              .bind("destroyed", completedAt, requestJson.deployment_ref)
              .run();
          }

          await env.DB.prepare(
            `UPDATE environments
             SET status = ?, destroyed_at = ?
             WHERE workflow_run_id = ?`,
          )
            .bind("destroyed", completedAt, attempt.workflow_run_id)
            .run();
        } else {
          return Response.json(
            { error: `Unsupported job_type: ${String(attempt.job_type)}` },
            { status: 400 },
          );
        }

        const doId = env.WORKFLOW_COORDINATOR.idFromName(attempt.workflow_run_id);
        const stub = env.WORKFLOW_COORDINATOR.get(doId);
        await stub.fetch(new Request("https://do/resume", { method: "POST" }));

        return Response.json({ ok: true, attempt_id: attemptId, status: body.status });
      } else {
        const completedAt = nowIso();
        const errorMessage = body.error_message ?? "External job failed";

        await env.DB.prepare(
          `UPDATE deploy_job_attempts
           SET status = ?, error_message = ?, completed_at = ?
           WHERE id = ?`,
        )
          .bind(
            "failed",
            errorMessage,
            completedAt,
            attemptId,
          )
          .run();

        await env.DB.prepare(
          `UPDATE deploy_jobs
           SET status = ?, error_message = ?, completed_at = ?, terminal_attempt_no = ?
           WHERE id = ?`,
        )
          .bind(
            "failed",
            errorMessage,
            completedAt,
            attempt.attempt_no,
            attempt.job_id,
          )
          .run();

        await emitEvent(env.DB, {
          traceId: attempt.trace_id,
          workflowRunId: attempt.workflow_run_id,
          stepName: attempt.step_name as never,
          eventType:
            attempt.job_type === "deploy_preview"
              ? "deploy.job_failed"
              : "teardown.job_failed",
          payload: {
            job_id: attempt.job_id,
            attempt_id: attemptId,
            attempt_no: attempt.attempt_no,
            job_type: attempt.job_type,
            provider: attempt.provider,
            error_message: errorMessage,
          },
        });

        await env.DB.prepare(
          `UPDATE workflow_steps
           SET status = ?, completed_at = ?, error_message = ?
           WHERE workflow_run_id = ? AND step_name = ? AND status = ?`,
        )
          .bind(
            "failed",
            completedAt,
            errorMessage,
            attempt.workflow_run_id,
            attempt.step_name,
            "waiting",
          )
          .run();

        const doId = env.WORKFLOW_COORDINATOR.idFromName(attempt.workflow_run_id);
        const stub = env.WORKFLOW_COORDINATOR.get(doId);
        await stub.fetch(new Request("https://do/resume", { method: "POST" }));

        return Response.json({ ok: true, attempt_id: attemptId, status: body.status });
      }
    }

    if (request.method === "GET" && url.pathname.startsWith("/debug/deploy-jobs/")) {
      if (env.APP_ENV !== "dev") {
        return Response.json({ error: "Not found" }, { status: 404 });
      }

      const jobId = url.pathname.split("/")[3];
      const job = await env.DB.prepare(`SELECT * FROM deploy_jobs WHERE id = ?`)
        .bind(jobId)
        .first();

      if (!job) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }

      return Response.json({ job });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, app: "aep-control-plane" });
    }

    if (request.method === "GET" && url.pathname === "/healthz") {
      return handleHealthz(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

export { WorkflowCoordinatorDO };