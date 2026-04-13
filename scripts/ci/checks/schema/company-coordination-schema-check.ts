import assert from "node:assert/strict";
import type { D1Database } from "@cloudflare/workers-types";

type SqliteRow = {
  name?: string;
};

type PragmaColumnRow = {
  name: string;
};

export async function checkCoordinationSchema(db: D1Database): Promise<void> {
  const requiredTables = [
    "tasks",
    "task_dependencies",
    "employee_messages",
    "task_artifacts",
    "message_threads",
  ];

  for (const table of requiredTables) {
    const row = await db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
      .bind(table)
      .first<SqliteRow>();

    assert.ok(row?.name === table, `Missing required table: ${table}`);
  }

  const pragma = await db.prepare(`PRAGMA table_info(tasks)`).all<PragmaColumnRow>();

  const columnNames = new Set(
    (pragma.results ?? []).map((row: PragmaColumnRow) => row.name),
  );

  const requiredTaskColumns = [
    "id",
    "company_id",
    "originating_team_id",
    "assigned_team_id",
    "owner_employee_id",
    "assigned_employee_id",
    "created_by_employee_id",
    "task_type",
    "title",
    "status",
    "payload",
    "blocking_dependency_count",
  ];

  for (const column of requiredTaskColumns) {
    assert.ok(columnNames.has(column), `Missing column in tasks: ${column}`);
  }

  const artifactPragma = await db
    .prepare(`PRAGMA table_info(task_artifacts)`)
    .all<PragmaColumnRow>();

  const artifactColumnNames = new Set(
    (artifactPragma.results ?? []).map((row: PragmaColumnRow) => row.name),
  );

  const requiredArtifactColumns = [
    "id",
    "task_id",
    "company_id",
    "artifact_type",
    "created_by_employee_id",
    "summary",
    "content_json",
    "created_at",
    "updated_at",
  ];

  for (const column of requiredArtifactColumns) {
    assert.ok(
      artifactColumnNames.has(column),
      `Missing column in task_artifacts: ${column}`,
    );
  }

  const threadPragma = await db
    .prepare(`PRAGMA table_info(message_threads)`)
    .all<PragmaColumnRow>();

  const threadColumnNames = new Set(
    (threadPragma.results ?? []).map((row: PragmaColumnRow) => row.name),
  );

  const requiredThreadColumns = [
    "thread_id",
    "company_id",
    "topic",
    "created_by_employee_id",
    "related_task_id",
    "related_artifact_id",
    "related_approval_id",
    "related_escalation_id",
    "visibility",
    "created_at",
    "updated_at",
  ];

  for (const column of requiredThreadColumns) {
    assert.ok(
      threadColumnNames.has(column),
      `Missing column in message_threads: ${column}`,
    );
  }

  const messagePragma = await db
    .prepare(`PRAGMA table_info(employee_messages)`)
    .all<PragmaColumnRow>();

  const messageColumnNames = new Set(
    (messagePragma.results ?? []).map((row: PragmaColumnRow) => row.name),
  );

  const requiredMessageColumns = [
    "message_id",
    "thread_id",
    "company_id",
    "sender_employee_id",
    "receiver_employee_id",
    "receiver_team_id",
    "message_type",
    "status",
    "source",
    "subject",
    "body",
    "payload_json",
    "requires_response",
    "response_action_type",
    "response_action_status",
    "caused_state_transition",
    "related_task_id",
    "related_artifact_id",
    "related_escalation_id",
    "related_approval_id",
    "created_at",
    "updated_at",
  ];

  for (const column of requiredMessageColumns) {
    assert.ok(
      messageColumnNames.has(column),
      `Missing column in employee_messages: ${column}`,
    );
  }

  console.log("company-coordination-schema-check passed", {
    requiredTables,
    requiredTaskColumns,
    requiredArtifactColumns,
    requiredThreadColumns,
    requiredMessageColumns,
  });
}