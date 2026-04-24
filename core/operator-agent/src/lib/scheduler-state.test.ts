import assert from "node:assert/strict";
import test from "node:test";
import {
  getOperatorSchedulerCadence,
  getOperatorSchedulerStatus,
  updateOperatorSchedulerCadence,
} from "./scheduler-state";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

type SchedulerStateRow = {
  scheduler_name: string;
  team_tick_interval_minutes: number;
  manager_tick_interval_minutes: number;
  updated_at: string;
  updated_by: string | null;
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

  async first<T>(): Promise<T | null> {
    return (this.db.execute(this.sql, this.boundArgs, "first") as T | null) ?? null;
  }

  async run(): Promise<void> {
    this.db.execute(this.sql, this.boundArgs, "run");
  }
}

class FakeD1Database {
  private schedulerState: SchedulerStateRow | null = null;

  prepare(sql: string): FakePreparedStatement {
    return new FakePreparedStatement(this, sql);
  }

  execute(sql: string, args: unknown[], mode: "first" | "run"): unknown {
    const normalized = sql.replace(/\s+/g, " ").trim();

    if (normalized.startsWith("INSERT OR IGNORE INTO operator_scheduler_state")) {
      if (!this.schedulerState) {
        this.schedulerState = {
          scheduler_name: String(args[0]),
          team_tick_interval_minutes: Number(args[1]),
          manager_tick_interval_minutes: Number(args[2]),
          updated_at: String(args[3]),
          updated_by: (args[4] as string | null) ?? null,
        };
      }
      return null;
    }

    if (
      normalized.includes("FROM operator_scheduler_state") &&
      normalized.includes("WHERE scheduler_name = ?") &&
      mode === "first"
    ) {
      const schedulerName = String(args[0]);
      return this.schedulerState?.scheduler_name === schedulerName
        ? { ...this.schedulerState }
        : null;
    }

    if (normalized.startsWith("UPDATE operator_scheduler_state SET")) {
      if (!this.schedulerState) {
        throw new Error("Cannot update missing scheduler state");
      }

      this.schedulerState = {
        ...this.schedulerState,
        team_tick_interval_minutes: Number(args[0]),
        manager_tick_interval_minutes: Number(args[1]),
        updated_at: String(args[2]),
        updated_by: String(args[3]),
      };
      return null;
    }

    throw new Error(`Unhandled fake D1 SQL: ${normalized}`);
  }
}

function createEnv(db?: FakeD1Database): OperatorAgentEnv {
  return {
    OPERATOR_AGENT_DB: (db as unknown as D1Database) ?? undefined,
    AEP_TEAM_TICK_INTERVAL_MINUTES: "30",
    AEP_MANAGER_TICK_INTERVAL_MINUTES: "60",
  } as OperatorAgentEnv;
}

test("scheduler cadence falls back to env defaults when D1 is unavailable", async () => {
  const cadence = await getOperatorSchedulerCadence(createEnv());

  assert.deepEqual(cadence, {
    teamTickIntervalMinutes: 30,
    managerTickIntervalMinutes: 60,
    updatedAt: null,
    updatedBy: null,
    source: "env_default",
  });
});

test("scheduler status persists initial defaults in D1 and returns cadence state", async () => {
  const env = createEnv(new FakeD1Database());

  const status = await getOperatorSchedulerStatus(env);

  assert.equal(status.primaryScheduler, "paperclip");
  assert.equal(status.cronFallbackEnabled, true);
  assert.equal(status.cadence.teamTickIntervalMinutes, 30);
  assert.equal(status.cadence.managerTickIntervalMinutes, 60);
  assert.equal(status.cadence.source, "d1");
});

test("scheduler cadence update writes new persisted intervals", async () => {
  const env = createEnv(new FakeD1Database());

  const status = await updateOperatorSchedulerCadence({
    env,
    teamTickIntervalMinutes: 12,
    managerTickIntervalMinutes: 24,
    updatedBy: "dashboard_operator",
  });

  assert.equal(status.cadence.teamTickIntervalMinutes, 12);
  assert.equal(status.cadence.managerTickIntervalMinutes, 24);
  assert.equal(status.cadence.updatedBy, "dashboard_operator");
  assert.equal(status.cadence.source, "d1");
});

test("scheduler cadence update rejects invalid intervals", async () => {
  const env = createEnv(new FakeD1Database());

  await assert.rejects(
    () =>
      updateOperatorSchedulerCadence({
        env,
        teamTickIntervalMinutes: 0,
        managerTickIntervalMinutes: 24,
        updatedBy: "dashboard_operator",
      }),
    /teamTickIntervalMinutes must be an integer between 1 and 60/,
  );
});