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

type DeployJobType = "deploy_preview" | "teardown_preview";

type DeployJobCallbackBody = {
  status: "succeeded" | "failed";
  result?: Record<string, unknown>;
  error_message?: string;
};

type DeployPreviewResult = {
  deployment_ref?: string;
  preview_url?: string;
  url?: string;
};

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
      return Response.json({ trace_id: traceId, events: events.results ?? [] });
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
      url.pathname.match(/^\/internal\/deploy-jobs\/[^/]+\/callback$/)
    ) {
      const jobId = url.pathname.split("/")[3];
      const authHeader = request.headers.get("authorization");
      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length)
        : null;

      const body = (await json(request)) as DeployJobCallbackBody;

      const job = await env.DB.prepare(
        `SELECT id, workflow_run_id, step_name, job_type, provider, status, request_json, callback_token_hash
         FROM deploy_jobs
         WHERE id = ?`,
      )
        .bind(jobId)
        .first<{
          id: string;
          workflow_run_id: string;
          step_name: string;
          job_type: DeployJobType;
          provider: string;
          status: string;
          request_json: string;
          callback_token_hash: string;
        }>();

      if (!job) {
        return Response.json({ error: "Deploy job not found" }, { status: 404 });
      }

      const ok = await verifyCallbackToken(job.callback_token_hash, token);
      if (!ok) {
        return Response.json({ error: "Unauthorized callback" }, { status: 401 });
      }

      const requestJson = JSON.parse(job.request_json) as {
        deployment_ref?: string;
        environment_id?: string;
        service_name?: string;
      };

      const deployResult = (body.result ?? {}) as DeployPreviewResult;

      if (body.status === "succeeded") {
        const completedAt = nowIso();

        await env.DB.prepare(
          `UPDATE deploy_jobs
           SET status = ?, result_json = ?, completed_at = ?
           WHERE id = ?`,
        )
          .bind(
            "succeeded",
            JSON.stringify(body.result ?? {}),
            completedAt,
            jobId,
          )
          .run();

        await env.DB.prepare(
          `UPDATE workflow_steps
           SET status = ?, completed_at = ?, error_message = NULL
           WHERE workflow_run_id = ? AND step_name = ? AND status = ?`,
        )
          .bind(
            "completed",
            completedAt,
            job.workflow_run_id,
            job.step_name,
            "waiting",
          )
          .run();

        if (job.job_type === "deploy_preview") {
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

          const existingDeployment = await env.DB.prepare(
            `SELECT id FROM deployments WHERE environment_id = ? LIMIT 1`,
          )
            .bind(requestJson.environment_id ?? null)
            .first<{ id: string }>();

          if (existingDeployment) {
            await env.DB.prepare(
              `UPDATE deployments
               SET deployment_provider = ?, deployment_ref = ?, url = ?, status = ?
               WHERE id = ?`,
            )
              .bind(
                job.provider,
                deploymentRef,
                previewUrl,
                "deployed",
                existingDeployment.id,
              )
              .run();
          } else if (requestJson.environment_id) {
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
                newId("dep"),
                requestJson.environment_id,
                job.provider,
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
        } else if (job.job_type === "teardown_preview") {
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
            .bind("destroyed", completedAt, job.workflow_run_id)
            .run();
        } else {
          return Response.json(
            { error: `Unsupported job_type: ${String(job.job_type)}` },
            { status: 400 },
          );
        }
      } else {
        const completedAt = nowIso();
        const errorMessage = body.error_message ?? "External job failed";

        await env.DB.prepare(
          `UPDATE deploy_jobs
           SET status = ?, error_message = ?, completed_at = ?
           WHERE id = ?`,
        )
          .bind(
            "failed",
            errorMessage,
            completedAt,
            jobId,
          )
          .run();

        await env.DB.prepare(
          `UPDATE workflow_steps
           SET status = ?, completed_at = ?, error_message = ?
           WHERE workflow_run_id = ? AND step_name = ? AND status = ?`,
        )
          .bind(
            "failed",
            completedAt,
            errorMessage,
            job.workflow_run_id,
            job.step_name,
            "waiting",
          )
          .run();
      }

      const doId = env.WORKFLOW_COORDINATOR.idFromName(job.workflow_run_id);
      const stub = env.WORKFLOW_COORDINATOR.get(doId);
      await stub.fetch(new Request("https://do/resume", { method: "POST" }));

      return Response.json({ ok: true, job_id: jobId, status: body.status });
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