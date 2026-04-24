import { getConfig } from "@aep/operator-agent/config";
import { isCronFallbackEnabled } from "@aep/operator-agent/lib/fallback-config";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

const SCHEDULER_NAME = "operator-agent";

type SchedulerStateRow = {
  scheduler_name: string;
  team_tick_interval_minutes: number | string;
  manager_tick_interval_minutes: number | string;
  updated_at: string;
  updated_by: string | null;
};

export type OperatorSchedulerCadence = {
  teamTickIntervalMinutes: number;
  managerTickIntervalMinutes: number;
  updatedAt: string | null;
  updatedBy: string | null;
  source: "d1" | "env_default";
};

export type OperatorSchedulerStatus = {
  primaryScheduler: "paperclip";
  cronFallbackEnabled: boolean;
  cadence: OperatorSchedulerCadence;
};

function normalizeInterval(value: unknown, fallback: number): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const normalized = Math.trunc(parsed);
  if (normalized < 1 || normalized > 60) {
    return fallback;
  }

  return normalized;
}

function getDefaultCadence(env?: OperatorAgentEnv): Pick<
  OperatorSchedulerCadence,
  "teamTickIntervalMinutes" | "managerTickIntervalMinutes"
> {
  const config = getConfig(env);
  return {
    teamTickIntervalMinutes: config.teamTickIntervalMinutes,
    managerTickIntervalMinutes: config.managerTickIntervalMinutes,
  };
}

async function ensureSchedulerState(db: D1Database, env?: OperatorAgentEnv): Promise<void> {
  const defaults = getDefaultCadence(env);
  await db
    .prepare(
      `INSERT OR IGNORE INTO operator_scheduler_state (
         scheduler_name,
         team_tick_interval_minutes,
         manager_tick_interval_minutes,
         updated_at,
         updated_by
       ) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      SCHEDULER_NAME,
      defaults.teamTickIntervalMinutes,
      defaults.managerTickIntervalMinutes,
      new Date().toISOString(),
      null,
    )
    .run();
}

function mapSchedulerCadence(
  row: SchedulerStateRow,
  env?: OperatorAgentEnv,
): OperatorSchedulerCadence {
  const defaults = getDefaultCadence(env);

  return {
    teamTickIntervalMinutes: normalizeInterval(
      row.team_tick_interval_minutes,
      defaults.teamTickIntervalMinutes,
    ),
    managerTickIntervalMinutes: normalizeInterval(
      row.manager_tick_interval_minutes,
      defaults.managerTickIntervalMinutes,
    ),
    updatedAt: row.updated_at ?? null,
    updatedBy: row.updated_by ?? null,
    source: "d1",
  };
}

export async function getOperatorSchedulerCadence(
  env?: OperatorAgentEnv,
): Promise<OperatorSchedulerCadence> {
  const defaults = getDefaultCadence(env);
  const db = env?.OPERATOR_AGENT_DB;

  if (!db) {
    return {
      ...defaults,
      updatedAt: null,
      updatedBy: null,
      source: "env_default",
    };
  }

  await ensureSchedulerState(db, env);

  const row = await db
    .prepare(
      `SELECT
         scheduler_name,
         team_tick_interval_minutes,
         manager_tick_interval_minutes,
         updated_at,
         updated_by
       FROM operator_scheduler_state
       WHERE scheduler_name = ?
       LIMIT 1`,
    )
    .bind(SCHEDULER_NAME)
    .first<SchedulerStateRow>();

  if (!row) {
    return {
      ...defaults,
      updatedAt: null,
      updatedBy: null,
      source: "env_default",
    };
  }

  return mapSchedulerCadence(row, env);
}

export async function getOperatorSchedulerStatus(
  env?: OperatorAgentEnv,
): Promise<OperatorSchedulerStatus> {
  return {
    primaryScheduler: "paperclip",
    cronFallbackEnabled: isCronFallbackEnabled(env),
    cadence: await getOperatorSchedulerCadence(env),
  };
}

export async function updateOperatorSchedulerCadence(args: {
  env: OperatorAgentEnv;
  teamTickIntervalMinutes: number;
  managerTickIntervalMinutes: number;
  updatedBy: string;
}): Promise<OperatorSchedulerStatus> {
  const db = args.env.OPERATOR_AGENT_DB;
  if (!db) {
    throw new Error("OPERATOR_AGENT_DB is required for scheduler cadence updates");
  }

  const teamTickIntervalMinutes = normalizeInterval(
    args.teamTickIntervalMinutes,
    Number.NaN,
  );
  const managerTickIntervalMinutes = normalizeInterval(
    args.managerTickIntervalMinutes,
    Number.NaN,
  );

  if (!Number.isFinite(teamTickIntervalMinutes)) {
    throw new Error("teamTickIntervalMinutes must be an integer between 1 and 60");
  }

  if (!Number.isFinite(managerTickIntervalMinutes)) {
    throw new Error("managerTickIntervalMinutes must be an integer between 1 and 60");
  }

  if (typeof args.updatedBy !== "string" || args.updatedBy.trim().length === 0) {
    throw new Error("updatedBy is required for scheduler cadence updates");
  }

  await ensureSchedulerState(db, args.env);

  const updatedAt = new Date().toISOString();
  await db
    .prepare(
      `UPDATE operator_scheduler_state
       SET team_tick_interval_minutes = ?,
           manager_tick_interval_minutes = ?,
           updated_at = ?,
           updated_by = ?
       WHERE scheduler_name = ?`,
    )
    .bind(
      teamTickIntervalMinutes,
      managerTickIntervalMinutes,
      updatedAt,
      args.updatedBy.trim(),
      SCHEDULER_NAME,
    )
    .run();

  return getOperatorSchedulerStatus(args.env);
}