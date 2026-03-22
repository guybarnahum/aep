import { emitEvent } from "../../observability/src/index";
import type { Env } from "../../types/src/index";
import type {
  StartWorkflowRequest,
  StepName,
} from "../../../packages/event-schema/src/index";
import type { Provider } from "../../../packages/shared/src/index";
import {
  DEFAULT_PROVIDER,
  newId,
  nowIso,
  sha256Hex,
} from "../../../packages/shared/src/index";
import {
  auditCleanup,
  runHealthCheck,
  runSmokeTest,
} from "../../../services/proving-ground/src/index";

interface State {
  workflowRunId: string;
  traceId: string;
  tenantId: string;
  projectId: string;
  repoUrl: string;
  branch: string;
  serviceName: string;
  provider: Provider;
  environmentId?: string;
  deploymentId?: string;
  deploymentRef?: string;
  previewUrl?: string;
  waitingJobId?: string;
  waitingStep?: StepName;
  cancelled: boolean;
}

const STEPS: StepName[] = [
  "INIT",
  "CREATE_ENV",
  "DEPLOY",
  "HEALTH_CHECK",
  "SMOKE_TEST",
  "TEARDOWN",
  "CLEANUP_AUDIT",
  "COMPLETE",
];

export class WorkflowCoordinatorDO {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/start") {
      const body = (await request.json()) as StartWorkflowRequest & {
        workflow_run_id: string;
        trace_id: string;
      };

      const current: State = {
        workflowRunId: body.workflow_run_id,
        traceId: body.trace_id,
        tenantId: body.tenant_id,
        projectId: body.project_id,
        repoUrl: body.repo_url,
        branch: body.branch,
        serviceName: body.service_name,
        provider: body.provider ?? (DEFAULT_PROVIDER as Provider),
        cancelled: false,
      };

      await this.state.storage.put("state", current);
      this.state.waitUntil(this.runWorkflow());

      return Response.json({
        ok: true,
        workflow_run_id: current.workflowRunId,
      });
    }

    if (request.method === "POST" && url.pathname === "/cancel") {
      const current = await this.state.storage.get<State>("state");

      if (!current) {
        return Response.json(
          { ok: false, error: "workflow state not found" },
          { status: 404 },
        );
      }

      current.cancelled = true;
      await this.state.storage.put("state", current);

      await this.env.DB.prepare(
        `UPDATE workflow_runs SET cancel_requested = 1 WHERE id = ?`,
      )
        .bind(current.workflowRunId)
        .run();

      return Response.json({ ok: true });
    }

    if (request.method === "GET" && url.pathname === "/state") {
      const current = await this.state.storage.get<State>("state");
      return Response.json(current ?? {});
    }

    if (request.method === "POST" && url.pathname === "/resume") {
      const current = await this.state.storage.get<State>("state");

      if (!current) {
        return Response.json(
          { ok: false, error: "workflow state not found" },
          { status: 404 },
        );
      }

      this.state.waitUntil(this.resumeWorkflow());
      return Response.json({ ok: true });
    }

    return new Response("Not found", { status: 404 });
  }

  private async runWorkflow(): Promise<void> {
    const current = await this.state.storage.get<State>("state");

    if (!current) {
      throw new Error("workflow state not found");
    }

    await this.setWorkflowStatus(current.workflowRunId, "running");

    await emitEvent(this.env.DB, {
      traceId: current.traceId,
      workflowRunId: current.workflowRunId,
      eventType: "workflow.started",
      payload: {
        service_name: current.serviceName,
        repo_url: current.repoUrl,
        branch: current.branch,
        provider: current.provider,
      },
    });

    try {
      for (const step of STEPS) {
        if (
          current.cancelled &&
          !["TEARDOWN", "CLEANUP_AUDIT", "COMPLETE"].includes(step)
        ) {
          await this.setWorkflowStatus(current.workflowRunId, "cancelled");
          break;
        }

        await this.runStep(step, current);
        await this.state.storage.put("state", current);

        if (current.waitingJobId) {
          return;
        }
      }

      const finalStatus = current.cancelled ? "cancelled" : "completed";

      await this.setWorkflowStatus(current.workflowRunId, finalStatus);

      await emitEvent(this.env.DB, {
        traceId: current.traceId,
        workflowRunId: current.workflowRunId,
        eventType: "workflow.completed",
        payload: { status: finalStatus },
      });
    } catch (error) {
      await this.setWorkflowStatus(current.workflowRunId, "failed");

      await emitEvent(this.env.DB, {
        traceId: current.traceId,
        workflowRunId: current.workflowRunId,
        eventType: "workflow.failed",
        payload: {
          message: error instanceof Error ? error.message : String(error),
        },
      });

      throw error;
    }
  }

  private async runStep(step: StepName, current: State): Promise<void> {
    const stepId = newId("step");
    const startedAt = nowIso();

    await this.env.DB.prepare(
      `INSERT INTO workflow_steps (id, workflow_run_id, step_name, status, started_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(stepId, current.workflowRunId, step, "running", startedAt)
      .run();

    await emitEvent(this.env.DB, {
      traceId: current.traceId,
      workflowRunId: current.workflowRunId,
      stepName: step,
      eventType: "step.started",
      payload: { step },
    });

    try {
      // Unused for now : const adapter = new WorkerDeploymentAdapter();

      switch (step) {
        case "INIT": {
          break;
        }

        case "CREATE_ENV": {
          current.environmentId = newId("env");

          await this.env.DB.prepare(
            `INSERT INTO environments (id, workflow_run_id, tenant_id, project_id, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
            .bind(
              current.environmentId,
              current.workflowRunId,
              current.tenantId,
              current.projectId,
              "created",
              nowIso(),
            )
            .run();

          break;
        }

        case "DEPLOY": {
          if (!current.environmentId) {
            throw new Error("environmentId missing before DEPLOY");
          }

          current.deploymentId = newId("dep");
          current.deploymentRef = `sim-${current.workflowRunId}`;
          current.previewUrl = "https://example.invalid";

          await emitEvent(this.env.DB, {
            traceId: current.traceId,
            workflowRunId: current.workflowRunId,
            stepName: step,
            eventType: "deployment.started",
            payload: {
              provider: current.provider,
              service_name: current.serviceName,
              workflow_run_id: current.workflowRunId,
              environment_id: current.environmentId,
              mode: "simulated",
            },
          });

          await this.env.DB.prepare(
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
              current.deploymentId,
              current.environmentId,
              current.provider,
              current.deploymentRef,
              current.previewUrl,
              "deployed",
              nowIso(),
            )
            .run();

          await this.env.DB.prepare(
            `UPDATE environments SET status = ?, preview_url = ? WHERE id = ?`,
          )
            .bind("deployed", current.previewUrl, current.environmentId)
            .run();

          await emitEvent(this.env.DB, {
            traceId: current.traceId,
            workflowRunId: current.workflowRunId,
            stepName: step,
            eventType: "deployment.completed",
            payload: {
              provider: current.provider,
              deployment_ref: current.deploymentRef,
              url: current.previewUrl,
              mode: "simulated",
            },
          });

          break;
        }

        case "HEALTH_CHECK": {
          if (!current.previewUrl) {
            throw new Error("previewUrl missing before HEALTH_CHECK");
          }

          await runHealthCheck(current.previewUrl);

          await emitEvent(this.env.DB, {
            traceId: current.traceId,
            workflowRunId: current.workflowRunId,
            stepName: step,
            eventType: "health_check.passed",
            payload: {
              url: current.previewUrl,
              expected_status: 200,
            },
          });

          break;
        }

        case "SMOKE_TEST": {
          if (!current.previewUrl) {
            throw new Error("previewUrl missing before SMOKE_TEST");
          }

          await runSmokeTest(current.previewUrl);

          await emitEvent(this.env.DB, {
            traceId: current.traceId,
            workflowRunId: current.workflowRunId,
            stepName: step,
            eventType: "smoke_test.passed",
            payload: {
              url: `${current.previewUrl}/hello`,
            },
          });

          break;
        }

        case "TEARDOWN": {
          await emitEvent(this.env.DB, {
            traceId: current.traceId,
            workflowRunId: current.workflowRunId,
            stepName: step,
            eventType: "teardown.started",
            payload: {
              provider: current.provider,
              environment_id: current.environmentId,
              deployment_id: current.deploymentId,
              deployment_ref: current.deploymentRef,
              mode: "simulated",
            },
          });

          if (current.deploymentId) {
            await this.env.DB.prepare(
              `UPDATE deployments SET status = ?, destroyed_at = ? WHERE id = ?`,
            )
              .bind("destroyed", nowIso(), current.deploymentId)
              .run();
          }

          if (current.environmentId) {
            await this.env.DB.prepare(
              `UPDATE environments SET status = ?, destroyed_at = ? WHERE id = ?`,
            )
              .bind("destroyed", nowIso(), current.environmentId)
              .run();
          }

          await emitEvent(this.env.DB, {
            traceId: current.traceId,
            workflowRunId: current.workflowRunId,
            stepName: step,
            eventType: "teardown.completed",
            payload: {
              provider: current.provider,
              environment_id: current.environmentId,
              deployment_id: current.deploymentId,
              mode: "simulated",
            },
          });

          break;
        }

        case "CLEANUP_AUDIT": {
          const envCheck = current.environmentId
            ? await this.env.DB.prepare(
                `SELECT status FROM environments WHERE id = ?`,
              )
                .bind(current.environmentId)
                .first<{ status: string }>()
            : null;

          const depCheck = current.deploymentId
            ? await this.env.DB.prepare(
                `SELECT status FROM deployments WHERE id = ?`,
              )
                .bind(current.deploymentId)
                .first<{ status: string }>()
            : null;

          const result = await auditCleanup({
            environmentStatus: envCheck?.status,
            deploymentStatus: depCheck?.status,
          });

          await emitEvent(this.env.DB, {
            traceId: current.traceId,
            workflowRunId: current.workflowRunId,
            stepName: step,
            eventType: result.ok
              ? "cleanup.audit.passed"
              : "cleanup.audit.failed",
            payload: result as unknown as Record<string, unknown>,
          });

          if (!result.ok) {
            throw new Error("Cleanup audit failed");
          }

          break;
        }

        case "COMPLETE": {
          break;
        }
      }

      await this.env.DB.prepare(
        `UPDATE workflow_steps SET status = ?, completed_at = ? WHERE id = ?`,
      )
        .bind("completed", nowIso(), stepId)
        .run();

      await emitEvent(this.env.DB, {
        traceId: current.traceId,
        workflowRunId: current.workflowRunId,
        stepName: step,
        eventType: "step.completed",
        payload: { step },
      });
    } catch (error) {
      await this.env.DB.prepare(
        `UPDATE workflow_steps SET status = ?, completed_at = ?, error_message = ? WHERE id = ?`,
      )
        .bind(
          "failed",
          nowIso(),
          error instanceof Error ? error.message : String(error),
          stepId,
        )
        .run();

      await emitEvent(this.env.DB, {
        traceId: current.traceId,
        workflowRunId: current.workflowRunId,
        stepName: step,
        eventType: "step.failed",
        payload: {
          step,
          message: error instanceof Error ? error.message : String(error),
        },
      });

      throw error;
    }
  }

  private async setWorkflowStatus(
    workflowRunId: string,
    status: string,
  ): Promise<void> {
    const completedAt = ["completed", "failed", "cancelled"].includes(status)
      ? nowIso()
      : null;

    await this.env.DB.prepare(
      `UPDATE workflow_runs SET status = ?, completed_at = ? WHERE id = ?`,
    )
      .bind(status, completedAt, workflowRunId)
      .run();
  }

  private async createExternalJob(args: {
    stepName: StepName;
    jobType: "teardown_preview";
    provider: Provider;
    request: Record<string, unknown>;
  }): Promise<{ jobId: string; callbackToken: string }> {
    const current = await this.state.storage.get<State>("state");

    if (!current) {
      throw new Error("workflow state not found");
    }

    const jobId = newId("job");
    const callbackToken = crypto.randomUUID();
    const callbackTokenHash = await sha256Hex(callbackToken);

    await this.env.DB.prepare(
      `INSERT INTO deploy_jobs (
        id,
        workflow_run_id,
        step_name,
        job_type,
        provider,
        status,
        request_json,
        callback_token_hash,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        jobId,
        current.workflowRunId,
        args.stepName,
        args.jobType,
        args.provider,
        "queued",
        JSON.stringify(args.request),
        callbackTokenHash,
        nowIso(),
      )
      .run();

    await emitEvent(this.env.DB, {
      traceId: current.traceId,
      workflowRunId: current.workflowRunId,
      stepName: args.stepName,
      eventType: "deploy_job.created",
      payload: {
        job_id: jobId,
        job_type: args.jobType,
        provider: args.provider,
      },
    });

    current.waitingJobId = jobId;
    current.waitingStep = args.stepName;
    await this.state.storage.put("state", current);

    return { jobId, callbackToken };
  }

  private async resumeWorkflow(): Promise<void> {
    const current = await this.state.storage.get<State>("state");

    if (!current) {
      throw new Error("workflow state not found");
    }

    if (!current.waitingJobId || !current.waitingStep) {
      return;
    }

    const job = await this.env.DB.prepare(
      `SELECT status FROM deploy_jobs WHERE id = ?`,
    )
      .bind(current.waitingJobId)
      .first<{ status: string }>();

    if (!job) {
      throw new Error("waiting job not found");
    }

    if (job.status !== "succeeded") {
      if (job.status === "failed") {
        throw new Error(`External job failed: ${current.waitingJobId}`);
      }
      return;
    }

    current.waitingJobId = undefined;
    current.waitingStep = undefined;
    await this.state.storage.put("state", current);

    await emitEvent(this.env.DB, {
      traceId: current.traceId,
      workflowRunId: current.workflowRunId,
      eventType: "workflow.resumed",
      payload: {
        resumed_after_step: "TEARDOWN",
      },
    });

    await this.runStep("CLEANUP_AUDIT", current);
    await this.state.storage.put("state", current);

    await this.runStep("COMPLETE", current);
    await this.state.storage.put("state", current);

    const finalStatus = current.cancelled ? "cancelled" : "completed";

    await this.setWorkflowStatus(current.workflowRunId, finalStatus);

    await emitEvent(this.env.DB, {
      traceId: current.traceId,
      workflowRunId: current.workflowRunId,
      eventType: "workflow.completed",
      payload: { status: finalStatus },
    });
  }
}

