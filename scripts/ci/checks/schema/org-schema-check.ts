/* eslint-disable no-console */

import { execFileSync } from "node:child_process";
import {
  EMPLOYEE_PRODUCT_MANAGER_WEB_ID,
  EMPLOYEE_TIMEOUT_RECOVERY_ID,
  EMPLOYEE_VALIDATION_ENGINEER_ID,
  SEEDED_EMPLOYEE_IDS,
} from "../../shared/employee-ids";

export {};

type SqlRow = Record<string, unknown>;

type ExecuteJson = {
  result?: Array<{
    results?: SqlRow[];
    success?: boolean;
  }>;
  success?: boolean;
  errors?: Array<{ message?: string }>;
};

type ExecuteJsonResult = {
  results?: SqlRow[];
  success?: boolean;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function execSql(sql: string): SqlRow[] {
  const wranglerConfigPath = requireEnv("WRANGLER_CONFIG_PATH");
  const databaseRef = process.env.D1_DATABASE_REF ?? "DB";
  const executionLocation = process.env.WRANGLER_D1_EXECUTION_LOCATION;
  const args = [
    "wrangler",
    "d1",
    "execute",
    databaseRef,
    "--config",
    wranglerConfigPath,
  ];

  if (executionLocation === "local") {
    args.push("--local");
  } else if (executionLocation === "remote") {
    args.push("--remote");
  }

  const cfEnv = process.env.CF_ENV;
  if (cfEnv) {
    args.push("--env", cfEnv);
  }

  args.push("--command", sql, "--json");

  const output = execFileSync("npx", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const parsed = JSON.parse(output) as ExecuteJson | ExecuteJsonResult[];

  if (!Array.isArray(parsed) && (parsed.success === false || parsed.errors?.length)) {
    throw new Error(`wrangler d1 execute failed for SQL: ${sql}`);
  }

  const result = Array.isArray(parsed) ? parsed[0] : parsed.result?.[0];
  if (!result || result.success === false) {
    throw new Error(`No SQL result returned for query: ${sql}`);
  }

  return result.results ?? [];
}

function getCount(sql: string): number {
  const rows = execSql(sql);
  const firstRow = rows[0];
  if (!firstRow) {
    throw new Error(`Expected count row for query: ${sql}`);
  }

  const value = firstRow.count;
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number.parseInt(value, 10);
  }

  throw new Error(`Unexpected count result for query: ${sql}`);
}

function assertTableExists(tableName: string): void {
  const rows = execSql(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${tableName}'`
  );

  const resolvedName = String(rows[0]?.name ?? "");
  if (rows.length !== 1 || resolvedName !== tableName) {
    throw new Error(
      `Expected table to exist: ${tableName}. Received rows: ${JSON.stringify(rows)}`
    );
  }
}

function assertIds(sql: string, expectedIds: string[], label: string): void {
  const rows = execSql(sql);
  const actualIds = new Set(
    rows.map((row) => String(row.id ?? "")).filter(Boolean)
  );

  for (const expectedId of expectedIds) {
    if (!actualIds.has(expectedId)) {
      throw new Error(`Missing ${label}: ${expectedId}`);
    }
  }
}

function main(): void {
  requireEnv("CLOUDFLARE_API_TOKEN");
  requireEnv("CLOUDFLARE_ACCOUNT_ID");
  requireEnv("WRANGLER_CONFIG_PATH");

  const expectedTables = [
    "companies",
    "teams",
    "org_tenants",
    "tenant_environments",
    "services_catalog",
    "employees_catalog",
    "employee_scope_bindings",
    "org_policy_overlays",
  ];

  for (const tableName of expectedTables) {
    assertTableExists(tableName);
  }

  const companyCount = getCount(
    "SELECT COUNT(*) AS count FROM companies WHERE id = 'company_internal_aep'"
  );
  if (companyCount !== 1) {
    throw new Error("Expected seeded company company_internal_aep");
  }

  const teamCount = getCount(
    "SELECT COUNT(*) AS count FROM teams WHERE company_id = 'company_internal_aep'"
  );
  if (teamCount !== 3) {
    throw new Error(`Expected exactly 3 seeded teams, got ${teamCount}`);
  }

  assertIds(
    "SELECT id FROM teams WHERE company_id = 'company_internal_aep' ORDER BY id",
    ["team_infra", "team_web_product", "team_validation"],
    "team"
  );

  assertIds(
    "SELECT id FROM org_tenants ORDER BY id",
    ["tenant_internal_aep", "tenant_qa", "tenant_async_validation"],
    "org tenant"
  );

  const envRows = execSql(
    "SELECT environment_name FROM tenant_environments ORDER BY environment_name"
  );
  const envNames = new Set(
    envRows
      .map((row) => String(row.environment_name ?? ""))
      .filter(Boolean)
  );
  for (const environmentName of [
    "preview",
    "staging",
    "production",
    "async_validation",
  ]) {
    if (!envNames.has(environmentName)) {
      throw new Error(`Missing tenant environment: ${environmentName}`);
    }
  }

  assertIds(
    "SELECT id FROM services_catalog ORDER BY id",
    [
      "service_control_plane",
      "service_operator_agent",
      "service_dashboard",
      "service_ops_console",
    ],
    "service"
  );

  assertIds(
    "SELECT id FROM employees_catalog ORDER BY id",
    [...SEEDED_EMPLOYEE_IDS].filter((employeeId) => employeeId !== "pm001" && employeeId !== "qa002"),
    "employee"
  );

  const scopeBindingCount = getCount(
    "SELECT COUNT(*) AS count FROM employee_scope_bindings"
  );
  if (scopeBindingCount < 10) {
    throw new Error(
      `Expected at least 10 employee scope bindings, got ${scopeBindingCount}`
    );
  }

  for (const employeeId of [
    EMPLOYEE_TIMEOUT_RECOVERY_ID,
    EMPLOYEE_PRODUCT_MANAGER_WEB_ID,
    EMPLOYEE_VALIDATION_ENGINEER_ID,
  ]) {
    const count = getCount(
      `SELECT COUNT(*) AS count FROM employee_scope_bindings WHERE employee_id = '${employeeId}'`
    );
    if (count < 1) {
      throw new Error(`Expected scope binding for employee: ${employeeId}`);
    }
  }

  console.log("org-schema-check passed", {
    tablesValidated: expectedTables.length,
    teamCount,
    scopeBindingCount,
  });
}

main();