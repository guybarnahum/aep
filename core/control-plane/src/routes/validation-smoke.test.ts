import assert from "node:assert/strict";
import test from "node:test";
import {
  handlePauseValidationSchedulerRoute,
  handleResumeValidationSchedulerRoute,
  handleRunValidationNowRoute,
  handleScheduleRecurringValidationRoute,
  handleValidationOverviewRoute,
  handleValidationSchedulerRoute,
} from "./org";

type ValidationType =
  | "runtime_read_safety"
  | "contract_surface"
  | "ownership_surface";

type ValidationRunRow = {
  id: string;
  dispatch_batch_id: string | null;
  validation_type: ValidationType;
  requested_by: string;
  assigned_to: string;
  status: "queued" | "running" | "completed" | "failed";
  target_base_url: string;
  result_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

type ValidationResultRow = {
  id: string;
  dispatch_batch_id: string | null;
  team_id: string;
  validation_type: ValidationType;
  status: "passed" | "failed" | "warn";
  executed_by: string;
  summary: string;
  created_at: string;
  owner_team: string | null;
  severity: "info" | "warn" | "failed" | "critical" | null;
  escalation_state: "none" | "assigned" | "escalated" | null;
  audit_status: "pending" | "reviewed" | null;
  audited_by: string | null;
  audited_at: string | null;
};

type ValidationSchedulerStateRow = {
  scheduler_name: string;
  is_paused: number;
  pause_reason: string | null;
  paused_by: string | null;
  paused_at: string | null;
  resumed_by: string | null;
  resumed_at: string | null;
  last_run_requested_by: string | null;
  last_run_requested_at: string | null;
  last_dispatch_batch_id: string | null;
  updated_at: string;
};

class FakePreparedStatement {
  private boundArgs: unknown[] = [];

  constructor(
    private readonly db: FakeD1Database,
    private readonly sql: string,
  ) {}

  bind(...args: unknown[]): FakePreparedStatement {
    this.boundArgs = args;
    return this;
  }

  async run(): Promise<{ success: boolean }> {
    this.db.execute(this.sql, this.boundArgs, "run");
    return { success: true };
  }

  async first<T>(): Promise<T | null> {
    return (this.db.execute(this.sql, this.boundArgs, "first") as T | null) ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: (this.db.execute(this.sql, this.boundArgs, "all") as T[]) ?? [] };
  }
}

class FakeD1Database {
  private schedulerState: ValidationSchedulerStateRow | null = null;
  private readonly validationRuns: ValidationRunRow[] = [];
  private readonly validationResults: ValidationResultRow[] = [];

  prepare(sql: string): FakePreparedStatement {
    return new FakePreparedStatement(this, sql);
  }

  execute(sql: string, args: unknown[], mode: "run" | "first" | "all"): unknown {
    const normalized = sql.replace(/\s+/g, " ").trim();

    if (normalized.startsWith("INSERT OR IGNORE INTO validation_scheduler_state")) {
      if (!this.schedulerState) {
        this.schedulerState = {
          scheduler_name: String(args[0]),
          is_paused: Number(args[1]),
          pause_reason: toNullableString(args[2]),
          paused_by: toNullableString(args[3]),
          paused_at: toNullableString(args[4]),
          resumed_by: toNullableString(args[5]),
          resumed_at: toNullableString(args[6]),
          last_run_requested_by: toNullableString(args[7]),
          last_run_requested_at: toNullableString(args[8]),
          last_dispatch_batch_id: toNullableString(args[9]),
          updated_at: String(args[10]),
        };
      }
      return mode === "all" ? [] : null;
    }

    if (
      normalized.startsWith("SELECT scheduler_name, is_paused") &&
      normalized.includes("FROM validation_scheduler_state")
    ) {
      return this.schedulerState ? { ...this.schedulerState } : null;
    }

    if (normalized.startsWith("UPDATE validation_scheduler_state SET last_run_requested_by = ?")) {
      assert.ok(this.schedulerState, "scheduler state should exist before dispatch updates");
      this.schedulerState = {
        ...this.schedulerState,
        last_run_requested_by: toNullableString(args[0]),
        last_run_requested_at: toNullableString(args[1]),
        last_dispatch_batch_id: toNullableString(args[2]),
        updated_at: String(args[3]),
      };
      return null;
    }

    if (normalized.startsWith("UPDATE validation_scheduler_state SET is_paused = 1,")) {
      assert.ok(this.schedulerState, "scheduler state should exist before pause");
      this.schedulerState = {
        ...this.schedulerState,
        is_paused: 1,
        pause_reason: toNullableString(args[0]),
        paused_by: toNullableString(args[1]),
        paused_at: toNullableString(args[2]),
        updated_at: String(args[3]),
      };
      return null;
    }

    if (normalized.startsWith("UPDATE validation_scheduler_state SET is_paused = 0,")) {
      assert.ok(this.schedulerState, "scheduler state should exist before resume");
      this.schedulerState = {
        ...this.schedulerState,
        is_paused: 0,
        pause_reason: null,
        resumed_by: toNullableString(args[0]),
        resumed_at: toNullableString(args[1]),
        updated_at: String(args[2]),
      };
      return null;
    }

    if (normalized.startsWith("INSERT INTO validation_runs (")) {
      this.validationRuns.push({
        id: String(args[0]),
        dispatch_batch_id: toNullableString(args[1]),
        validation_type: args[2] as ValidationType,
        requested_by: String(args[3]),
        assigned_to: String(args[4]),
        status: args[5] as ValidationRunRow["status"],
        target_base_url: String(args[6]),
        result_id: toNullableString(args[7]),
        created_at: String(args[8]),
        started_at: toNullableString(args[9]),
        completed_at: toNullableString(args[10]),
      });
      return null;
    }

    if (
      normalized.startsWith("SELECT id, dispatch_batch_id, validation_type, requested_by") &&
      normalized.includes("FROM validation_runs") &&
      normalized.includes("WHERE id = ? LIMIT 1")
    ) {
      const row = this.validationRuns.find((run) => run.id === args[0]);
      return row ? { ...row } : null;
    }

    if (
      normalized.startsWith("SELECT id, dispatch_batch_id, validation_type, requested_by") &&
      normalized.includes("FROM validation_runs") &&
      normalized.includes("WHERE dispatch_batch_id = ?")
    ) {
      const dispatchBatchId = String(args[0]);
      const validationTypes = new Set(args.slice(1) as ValidationType[]);
      return this.validationRuns
        .filter(
          (run) =>
            run.dispatch_batch_id === dispatchBatchId &&
            run.status === "queued" &&
            validationTypes.has(run.validation_type),
        )
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .map((run) => ({ ...run }));
    }

    if (
      normalized.startsWith("SELECT id, dispatch_batch_id, validation_type, requested_by") &&
      normalized.includes("FROM validation_runs") &&
      normalized.includes("ORDER BY created_at DESC")
    ) {
      return this.validationRuns
        .slice()
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .map((run) => ({ ...run }));
    }

    if (normalized.startsWith("UPDATE validation_runs SET status = ?, started_at = ? WHERE id = ?")) {
      const run = this.requireRun(String(args[2]));
      run.status = args[0] as ValidationRunRow["status"];
      run.started_at = toNullableString(args[1]);
      return null;
    }

    if (normalized.startsWith("UPDATE validation_runs SET status = ?, result_id = ?, completed_at = ? WHERE id = ?")) {
      const run = this.requireRun(String(args[3]));
      run.status = args[0] as ValidationRunRow["status"];
      run.result_id = toNullableString(args[1]);
      run.completed_at = toNullableString(args[2]);
      return null;
    }

    if (normalized.startsWith("INSERT INTO validation_results (")) {
      this.validationResults.push({
        id: String(args[0]),
        dispatch_batch_id: toNullableString(args[1]),
        team_id: String(args[2]),
        validation_type: args[3] as ValidationType,
        status: args[4] as ValidationResultRow["status"],
        executed_by: String(args[5]),
        summary: String(args[6]),
        created_at: String(args[7]),
        owner_team: toNullableString(args[8]),
        severity: args[9] as ValidationResultRow["severity"],
        escalation_state: args[10] as ValidationResultRow["escalation_state"],
        audit_status: args[11] as ValidationResultRow["audit_status"],
        audited_by: toNullableString(args[12]),
        audited_at: toNullableString(args[13]),
      });
      return null;
    }

    if (
      normalized.startsWith("SELECT id, dispatch_batch_id, team_id, validation_type") &&
      normalized.includes("FROM validation_results") &&
      normalized.includes("WHERE id = ? LIMIT 1")
    ) {
      const row = this.validationResults.find((result) => result.id === args[0]);
      return row ? { ...row } : null;
    }

    if (normalized.startsWith("UPDATE validation_results SET owner_team = ?, severity = ?, escalation_state = ?, audit_status = ?, audited_by = ?, audited_at = ? WHERE id = ?")) {
      const result = this.requireResult(String(args[6]));
      result.owner_team = toNullableString(args[0]);
      result.severity = args[1] as ValidationResultRow["severity"];
      result.escalation_state = args[2] as ValidationResultRow["escalation_state"];
      result.audit_status = args[3] as ValidationResultRow["audit_status"];
      result.audited_by = toNullableString(args[4]);
      result.audited_at = toNullableString(args[5]);
      return null;
    }

    if (
      normalized.startsWith("SELECT id, dispatch_batch_id, team_id, validation_type") &&
      normalized.includes("FROM validation_results") &&
      normalized.includes("ORDER BY created_at DESC")
    ) {
      return this.validationResults
        .slice()
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .map((result) => ({ ...result }));
    }

    throw new Error(`Unhandled fake D1 SQL: ${normalized}`);
  }

  private requireRun(runId: string): ValidationRunRow {
    const run = this.validationRuns.find((entry) => entry.id === runId);
    assert.ok(run, `missing validation run ${runId}`);
    return run;
  }

  private requireResult(resultId: string): ValidationResultRow {
    const result = this.validationResults.find((entry) => entry.id === resultId);
    assert.ok(result, `missing validation result ${resultId}`);
    return result;
  }
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

function createEnv(): { DB: D1Database } {
  return {
    DB: new FakeD1Database() as unknown as D1Database,
  };
}

function createRequest(pathname: string, body?: Record<string, unknown>): Request {
  return new Request(`https://example.test${pathname}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function readJson(response: Response): Promise<any> {
  return response.json();
}

test("validation scheduler route returns default active state", async () => {
  const env = createEnv();

  const response = await handleValidationSchedulerRoute(
    createRequest("/validation/scheduler"),
    env,
  );
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(payload.scheduler.scheduler_name, "employee_validation_scheduler");
  assert.equal(payload.scheduler.paused, false);
  assert.equal(payload.scheduler.last_dispatch_batch_id, null);
});

test("pause and resume endpoints toggle scheduler state and recurring route skips while paused", async () => {
  const env = createEnv();

  const pauseResponse = await handlePauseValidationSchedulerRoute(
    createRequest("/validation/scheduler/pause", {
      requested_by: "dashboard_validation_operator",
      reason: "investigating validation failures",
    }),
    env,
  );
  const pausePayload = await readJson(pauseResponse);

  assert.equal(pauseResponse.status, 202);
  assert.equal(pausePayload.scheduler.paused, true);
  assert.equal(pausePayload.scheduler.pause_reason, "investigating validation failures");

  const recurringResponse = await handleScheduleRecurringValidationRoute(
    createRequest("/internal/validation/schedule-recurring", {
      requested_by: "recurring_validation_cron",
      mode: "full",
      reason: "scheduled_health",
    }),
    env,
  );
  const recurringPayload = await readJson(recurringResponse);

  assert.equal(recurringResponse.status, 202);
  assert.equal(recurringPayload.skipped, true);
  assert.equal(recurringPayload.scheduler.paused, true);

  const resumeResponse = await handleResumeValidationSchedulerRoute(
    createRequest("/validation/scheduler/resume", {
      requested_by: "dashboard_validation_operator",
    }),
    env,
  );
  const resumePayload = await readJson(resumeResponse);

  assert.equal(resumeResponse.status, 202);
  assert.equal(resumePayload.scheduler.paused, false);
  assert.equal(resumePayload.scheduler.pause_reason, null);
  assert.equal(resumePayload.scheduler.resumed_by, "dashboard_validation_operator");
});

test("run-now executes validations and overview reports manual runs with persisted scheduler metadata", async () => {
  const env = createEnv();

  const runNowResponse = await handleRunValidationNowRoute(
    createRequest("/validation/run-now", {
      requested_by: "dashboard_validation_operator",
      mode: "full",
      reason: "governance_review",
    }),
    env,
  );
  const runNowPayload = await readJson(runNowResponse);

  assert.equal(runNowResponse.status, 202);
  assert.equal(runNowPayload.trigger, "manual");
  assert.equal(runNowPayload.dispatched, 3);
  assert.equal(runNowPayload.executed, 3);
  assert.equal(runNowPayload.scheduler.last_run_requested_by, "dashboard_validation_operator");
  assert.ok(typeof runNowPayload.dispatch_batch_id === "string");

  const overviewResponse = await handleValidationOverviewRoute(
    createRequest("/validation/overview"),
    env,
  );
  const overviewPayload = await readJson(overviewResponse);

  assert.equal(overviewResponse.status, 200);
  assert.equal(overviewPayload.summary.total_runs, 3);
  assert.equal(overviewPayload.summary.manual_runs, 3);
  assert.equal(overviewPayload.summary.latest_result_status, "passed");
  assert.equal(overviewPayload.scheduler.last_run_requested_by, "dashboard_validation_operator");
  assert.equal(overviewPayload.scheduler.last_dispatch_batch_id, runNowPayload.dispatch_batch_id);
  assert.equal(overviewPayload.recent_runs.length, 3);
  assert.equal(overviewPayload.recent_results.length, 3);
  assert.ok(
    overviewPayload.recent_runs.every(
      (run: { origin: string; mode: string; status: string; target_base_url: string }) =>
        run.origin === "manual" &&
        run.mode === "full" &&
        run.status === "completed" &&
        run.target_base_url === "internal://control-plane/manual-validation-run-now",
    ),
  );
  assert.ok(
    overviewPayload.recent_results.every(
      (result: { origin: string; audit_status: string; status: string }) =>
        result.origin === "manual" &&
        result.audit_status === "reviewed" &&
        result.status === "passed",
    ),
  );
});

test("run-now runtime-only mode dispatches a single runtime validation run", async () => {
  const env = createEnv();

  const response = await handleRunValidationNowRoute(
    createRequest("/validation/run-now", {
      requested_by: "dashboard_validation_operator",
      mode: "runtime_only",
      reason: "drift_detection",
    }),
    env,
  );
  const payload = await readJson(response);

  assert.equal(response.status, 202);
  assert.equal(payload.dispatched, 1);
  assert.equal(payload.executed, 1);

  const overviewResponse = await handleValidationOverviewRoute(
    createRequest("/validation/overview"),
    env,
  );
  const overviewPayload = await readJson(overviewResponse);

  assert.equal(overviewPayload.summary.total_runs, 1);
  assert.equal(overviewPayload.recent_runs[0].validation_type, "runtime_read_safety");
  assert.equal(overviewPayload.recent_runs[0].mode, "runtime_only");
});