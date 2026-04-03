/* eslint-disable no-console */

import { execFileSync } from "node:child_process";

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
  const databaseRef = process.env.D1_DATABASE_REF ?? "OPERATOR_AGENT_DB";
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
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${tableName}'`,
  );

  const resolvedName = String(rows[0]?.name ?? "");
  if (rows.length !== 1 || resolvedName !== tableName) {
    throw new Error(
      `Expected table to exist: ${tableName}. Received rows: ${JSON.stringify(rows)}`,
    );
  }
}

function assertIds(sql: string, expectedIds: string[], label: string): void {
  const rows = execSql(sql);
  const actualIds = new Set(
    rows.map((row) => String(row.id ?? "")).filter(Boolean),
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

  const employeeCatalogCount = getCount(
    "SELECT COUNT(*) AS count FROM employees_catalog",
  );
  if (employeeCatalogCount < 7) {
    throw new Error(`Expected at least 7 employee catalog rows, got ${employeeCatalogCount}`);
  }

  assertIds(
    "SELECT id FROM employees_catalog ORDER BY id",
    [
      "emp_timeout_recovery_01",
      "emp_retry_supervisor_01",
      "emp_infra_ops_manager_01",
      "emp_product_manager_web_01",
      "emp_frontend_engineer_01",
      "emp_validation_pm_01",
      "emp_validation_engineer_01",
    ],
    "employee",
  );

  const scopeBindingCount = getCount(
    "SELECT COUNT(*) AS count FROM employee_scope_bindings",
  );
  if (scopeBindingCount < 10) {
    throw new Error(`Expected at least 10 employee scope bindings, got ${scopeBindingCount}`);
  }

  const providerRows = execSql(
    "SELECT id, provider FROM services_catalog ORDER BY id",
  );

  const providerById = new Map(
    providerRows.map((row) => [
      String(row.id ?? ""),
      String(row.provider ?? ""),
    ]),
  );

  for (const serviceId of [
    "service_control_plane",
    "service_operator_agent",
    "service_dashboard",
    "service_ops_console",
  ]) {
    if (providerById.get(serviceId) !== "cloudflare") {
      throw new Error(
        `Expected provider=cloudflare for ${serviceId}, got ${providerById.get(serviceId)}`,
      );
    }
  }

  console.log("operator-agent-org-schema-check passed", {
    tablesValidated: expectedTables.length,
    employeeCatalogCount,
    scopeBindingCount,
  });
}

main();