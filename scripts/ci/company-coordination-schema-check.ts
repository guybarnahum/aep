import assert from "node:assert/strict";
import type { D1Database } from "@cloudflare/workers-types";

type SqliteRow = {
  name?: string;
};

type PragmaColumnRow = {
  name: string;
};

export async function checkCoordinationSchema(db: D1Database): Promise<void> {
  const requiredTables = ["tasks", "task_dependencies", "employee_messages"];

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

  console.log("company-coordination-schema-check passed", {
    requiredTables,
    requiredTaskColumns,
  });
}