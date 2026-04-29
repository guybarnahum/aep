import { emitEvent } from "@aep/observability/index";
import type { Env } from "@aep/types/index";
import type {
  StartWorkflowRequest,
  StepName,
  DeployMode,
  TeardownMode,
} from "@aep/event-schema/index";
import type { Provider } from "@aep/shared";
import {
  DEFAULT_PROVIDER,
  newId,
  newToken,
  nowIso,
  sha256Hex,
} from "@aep/shared";
import {
  auditCleanup,
  runHealthCheck,
  runSmokeTest,
} from "@aep/proving-ground/index";

interface State {
  workflowRunId: string;
  traceId: string;
  tenantId: string;
  projectId: string;
  repoUrl: string;
  branch: string;
  serviceName: string;
  provider: Provider;
  deployMode: DeployMode;
  teardownMode: TeardownMode;
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

function isTerminalWorkflowStatus(status: string): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function isNonTerminalExternalJobStatus(status: string): boolean {
  return status === "queued" || status === "running" || status === "retry_scheduled";
}

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
        deployMode: body.deploy_mode ?? "sync",
        teardownMode: body.teardown_mode ?? "async",
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

    if (request.method === "POST" && url.pathname === "/callback-update") {
      const current = await this.state.storage.get<State>("state");

      if (!current) {
        return Response.json(
          { ok: false, error: "workflow state not found" },
          { status: 404 },
        );
      }

      const body = (await request.json()) as {
        deploymentRef?: string;
        previewUrl?: string;
        deploymentId?: string;
      };

      if (body.deploymentRef) {
        current.deploymentRef = body.deploymentRef;
      }

      if (body.previewUrl) {
        current.previewUrl = body.previewUrl;
      }

      if (body.deploymentId) {
        current.deploymentId = body.deploymentId;
      }

      await this.state.storage.put("state", current);

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
        deploy_mode: current.deployMode,
        teardown_mode: current.teardownMode,
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
          if (!current.waitingStep) {
            throw new Error(
              `waitingJobId set without waitingStep for workflow ${current.workflowRunId}`,
            );
          }
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
      await this.failWorkflow(current, error, { source: "runWorkflow" });
    }
  }

  private async runStep(
    step: StepName,
    current: State,
    options: { existingStepId?: string } = {},
  ): Promise<void> {
    const stepId = options.existingStepId ?? newId("step");
    const startedAt = nowIso();

    if (options.existingStepId) {
      await this.env.DB.prepare(
        `UPDATE workflow_steps
         SET status = ?, error_message = NULL
         WHERE id = ?`,
      )
        .bind("running", stepId)
        .run();
    } else {
      await this.env.DB.prepare(
        `INSERT INTO workflow_steps (id, workflow_run_id, step_name, status, started_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
        .bind(stepId, current.workflowRunId, step, "running", startedAt)
        .run();
    }

    await emitEvent(this.env.DB, {
      traceId: current.traceId,
      workflowRunId: current.workflowRunId,
      stepName: step,
      eventType: "step.started",
      payload: { step },
    });

    try {

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

          if (current.deployMode === "sync") {
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

          const { jobId, attemptId, attemptNo } =
            await this.createExternalJobWithAttempt(current, {
            stepName: step,
            jobType: "deploy_preview",
            provider: current.provider,
            request: {
              workflow_run_id: current.workflowRunId,
              environment_id: current.environmentId,
              service_name: current.serviceName,
              provider: current.provider,
            },
          });

          await emitEvent(this.env.DB, {
            traceId: current.traceId,
            workflowRunId: current.workflowRunId,
            stepName: step,
            eventType: "deploy.job_dispatched",
            payload: {
              job_id: jobId,
              attempt_id: attemptId,
              attempt_no: attemptNo,
              workflow_run_id: current.workflowRunId,
              environment_id: current.environmentId,
              service_name: current.serviceName,
              provider: current.provider,
              mode: "async",
              max_attempts: 3,
            },
          });

          await this.env.DB.prepare(
            `UPDATE workflow_steps SET status = ?, completed_at = NULL WHERE id = ?`,
          )
            .bind("waiting", stepId)
            .run();

          return;
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
          if (!current.deploymentRef) {
            throw new Error("deploymentRef missing before TEARDOWN");
          }

          if (current.teardownMode === "sync") {
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
                mode: "sync",
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
                deployment_ref: current.deploymentRef,
                mode: "sync",
              },
            });

            break;
          }

          const { jobId, attemptId, attemptNo } =
            await this.createExternalJobWithAttempt(current, {
            stepName: step,
            jobType: "teardown_preview",
            provider: current.provider,
            request: {
              workflow_run_id: current.workflowRunId,
              deployment_ref: current.deploymentRef,
              provider: current.provider,
            },
          });

          await emitEvent(this.env.DB, {
            traceId: current.traceId,
            workflowRunId: current.workflowRunId,
            stepName: step,
            eventType: "teardown.job_dispatched",
            payload: {
              job_id: jobId,
              attempt_id: attemptId,
              attempt_no: attemptNo,
              deployment_ref: current.deploymentRef,
              provider: current.provider,
              mode: "async",
              max_attempts: 3,
            },
          });

          await this.env.DB.prepare(
            `UPDATE workflow_steps SET status = ?, completed_at = NULL WHERE id = ?`,
          )
            .bind("waiting", stepId)
            .run();

          return;
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
          failure_kind: step === "CLEANUP_AUDIT" ? "cleanup_audit_failed" : "external_job_failed",
          waiting_job_id: current.waitingJobId ?? null,
        },
      });

      throw error;
    }
  }

  private async findWaitingStepId(
    workflowRunId: string,
    step: StepName,
  ): Promise<string | null> {
    const row = await this.env.DB.prepare(
      `SELECT id
       FROM workflow_steps
       WHERE workflow_run_id = ? AND step_name = ? AND status = ?
       ORDER BY started_at DESC
       LIMIT 1`,
    )
      .bind(workflowRunId, step, "waiting")
      .first<{ id: string }>();

    return row?.id ?? null;
  }

  private getResumePlan(step: StepName): StepName[] {
    switch (step) {
      case "TEARDOWN":
        return ["CLEANUP_AUDIT", "COMPLETE"];
      case "DEPLOY":
        return ["HEALTH_CHECK", "SMOKE_TEST", "TEARDOWN", "CLEANUP_AUDIT", "COMPLETE"];
      default:
        throw new Error(`No resume plan defined for step: ${step}`);
    }
  }

  private async setWorkflowStatus(
    workflowRunId: string,
    status: string,
  ): Promise<void> {
    const completedAt = isTerminalWorkflowStatus(status) ? nowIso() : null;

    await this.env.DB.prepare(
      `UPDATE workflow_runs SET status = ?, completed_at = ? WHERE id = ?`,
    )
      .bind(status, completedAt, workflowRunId)
      .run();

    const row = await this.env.DB.prepare(
      `SELECT status, completed_at FROM workflow_runs WHERE id = ?`,
    )
      .bind(workflowRunId)
      .first<{ status: string; completed_at: string | null }>();

    if (!row) {
      throw new Error(`workflow run not found after status update: ${workflowRunId}`);
    }

    if (isTerminalWorkflowStatus(row.status) && !row.completed_at) {
      throw new Error(
        `terminal workflow run missing completed_at: ${workflowRunId} status=${row.status}`,
      );
    }
  }

  private async failWorkflow(
    current: State,
    error: unknown,
    context: {
      source: "runWorkflow" | "resumeWorkflow";
    },
  ): Promise<never> {
    const message = error instanceof Error ? error.message : String(error);

    await this.setWorkflowStatus(current.workflowRunId, "failed");

    await emitEvent(this.env.DB, {
      traceId: current.traceId,
      workflowRunId: current.workflowRunId,
      eventType: "workflow.failed",
      payload: {
        message,
        failure_kind: "external_job_failed",
        waiting_job_id: current.waitingJobId ?? null,
        waiting_step: current.waitingStep ?? null,
        source: context.source,
      },
    });

    throw error instanceof Error ? error : new Error(message);
  }

  private async createExternalJobWithAttempt(
    current: State,
    args: {
      stepName: StepName;
      jobType: "deploy_preview" | "teardown_preview";
      provider: Provider;
      request: Record<string, unknown>;
    },
  ): Promise<{
    jobId: string;
    attemptId: string;
    attemptNo: number;
    callbackToken: string;
  }> {
    const jobId = newId("job");
    const attemptId = newId("attempt");
    const attemptNo = 1;
    const callbackToken = newToken(24);
    const callbackTokenHash = await sha256Hex(callbackToken);
    const createdAt = nowIso();

    await this.env.DB.prepare(
      `INSERT INTO deploy_jobs (
        id,
        workflow_run_id,
        step_name,
        job_type,
        provider,
        status,
        request_json,
        max_attempts,
        attempt_count,
        active_attempt_no,
        terminal_attempt_no,
        last_dispatched_at,
        callback_token_hash,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        jobId,
        current.workflowRunId,
        args.stepName,
        args.jobType,
        args.provider,
        "queued",
        JSON.stringify(args.request),
        3,
        1,
        1,
        null,
        createdAt,
        "__deprecated_use_attempt_table__",
        createdAt,
      )
      .run();

    await this.env.DB.prepare(
      `INSERT INTO deploy_job_attempts (
        id,
        job_id,
        attempt_no,
        status,
        callback_token_hash,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        attemptId,
        jobId,
        attemptNo,
        "queued",
        callbackTokenHash,
        createdAt,
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
        created_at: createdAt,
      },
    });

    const attemptCreatedEventType =
      args.jobType === "deploy_preview"
        ? "deploy.attempt_created"
        : "teardown.attempt_created";

    await emitEvent(this.env.DB, {
      traceId: current.traceId,
      workflowRunId: current.workflowRunId,
      stepName: args.stepName,
      eventType: attemptCreatedEventType,
      payload: {
        job_id: jobId,
        attempt_id: attemptId,
        attempt_no: attemptNo,
        job_type: args.jobType,
        provider: args.provider,
        created_at: createdAt,
      },
    });

    if (this.env.APP_ENV === "dev") {
      await emitEvent(this.env.DB, {
        traceId: current.traceId,
        workflowRunId: current.workflowRunId,
        stepName: args.stepName,
        eventType: "deploy_job.debug_token",
        payload: {
          job_id: jobId,
          attempt_id: attemptId,
          attempt_no: attemptNo,
          callback_token: callbackToken,
        },
      });
    }

    current.waitingJobId = jobId;
    current.waitingStep = args.stepName;
    await this.state.storage.put("state", current);

    return { jobId, attemptId, attemptNo, callbackToken };
  }

  private async resumeWorkflow(): Promise<void> {
    const current = await this.state.storage.get<State>("state");

    if (!current) {
      throw new Error("workflow state not found");
    }

    try {
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

        if (isNonTerminalExternalJobStatus(job.status)) {
          return;
        }

        throw new Error(
          `Unexpected external job status during resume: ${current.waitingJobId} status=${job.status}`,
        );
      }

      const resumedAfterStep = current.waitingStep;
      const resumedJobId = current.waitingJobId;

      if (!resumedAfterStep) {
        throw new Error("waitingStep missing during resume");
      }

      current.waitingJobId = undefined;
      current.waitingStep = undefined;
      await this.state.storage.put("state", current);

      await emitEvent(this.env.DB, {
        traceId: current.traceId,
        workflowRunId: current.workflowRunId,
        eventType: "workflow.resumed",
        payload: {
          resumed_after_step: resumedAfterStep,
          waiting_job_id: resumedJobId ?? null,
        },
      });

      const nextSteps = this.getResumePlan(resumedAfterStep);

      for (const step of nextSteps) {
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

      const finalRun = await this.env.DB.prepare(
        `SELECT status, completed_at FROM workflow_runs WHERE id = ?`,
      )
        .bind(current.workflowRunId)
        .first<{ status: string; completed_at: string | null }>();

      if (!finalRun) {
        throw new Error(`workflow run missing after completion: ${current.workflowRunId}`);
      }

      if (finalRun.status !== finalStatus) {
        throw new Error(
          `workflow final status mismatch after resume: expected=${finalStatus} actual=${finalRun.status}`,
        );
      }

      if (isTerminalWorkflowStatus(finalRun.status) && !finalRun.completed_at) {
        throw new Error(
          `terminal workflow missing completed_at after resume: ${current.workflowRunId}`,
        );
      }
    } catch (error) {
      await this.failWorkflow(current, error, { source: "resumeWorkflow" });
    }
  }
}