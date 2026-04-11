#!/usr/bin/env node

/**
 * scripts/ci/validate-runtime-read-safety.ts
 *
 * Validates Commit 14.1 runtime/read safety guarantees:
 *
 * 1. Happy-path runtime/read routes return expected JSON payload shapes.
 * 2. Missing resources return JSON 404 responses with error=not_found.
 * 3. Forced-failure probes return JSON 500 responses with
 *    error=runtime_projection_failed (when enabled).
 *
 * Usage:
 *   npx tsx scripts/ci/validate-runtime-read-safety.ts \
 *     --base-url https://your-control-plane.example.com
 *
 * Optional:
 *   --timeout-ms 10000
 *   --skip-happy false
 *   --skip-not-found false
 *   --check-forced-failure false
 *   --forced-failure-token 1
 *   --tenant-id tenant_internal_aep
 *   --service-id service_control_plane
 *   --company-id company_internal_aep
 *   --team-id team_infra
 *   --employee-id emp_timeout_recovery_01
 *   --run-id <real-run-id>
 *
 * Notes:
 * - forced-failure validation assumes temporary dev-only support like ?fail=1
 *   exists on selected routes. If it does not, pass:
 *     --check-forced-failure false
 * - if --run-id is omitted, the script will fetch /runs and use the first run.
 */

export {};

type CliOptions = {
  baseUrl: string;
  timeoutMs: number;
  skipHappy: boolean;
  skipNotFound: boolean;
  checkForcedFailure: boolean;
  forcedFailureToken: string;
  tenantId?: string;
  serviceId?: string;
  companyId?: string;
  teamId?: string;
  employeeId?: string;
  runId?: string;
};

type JsonRecord = Record<string, unknown>;

type RouteCheck = {
  name: string;
  path: string;
  expectedStatus: number;
  requiredKeys?: string[];
  expectedError?: string;
};

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string>();

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = argv[i + 1];

    if (!next || next.startsWith("--")) {
      args.set(key, "true");
      continue;
    }

    args.set(key, next);
    i += 1;
  }

  const baseUrl = args.get("base-url");
  if (!baseUrl) {
    throw new Error(
      [
        "Missing required argument: --base-url",
        "Example:",
        "  npx tsx scripts/ci/validate-runtime-read-safety.ts --base-url https://staging.example.com",
      ].join("\n"),
    );
  }

  return {
    baseUrl: trimTrailingSlash(baseUrl),
    timeoutMs: parsePositiveInt(args.get("timeout-ms") ?? "10000", "timeout-ms"),
    skipHappy: parseBoolean(args.get("skip-happy") ?? "false"),
    skipNotFound: parseBoolean(args.get("skip-not-found") ?? "false"),
    checkForcedFailure: parseBoolean(args.get("check-forced-failure") ?? "true"),
    forcedFailureToken: args.get("forced-failure-token") ?? "1",
    tenantId: args.get("tenant-id") ?? undefined,
    serviceId: args.get("service-id") ?? undefined,
    companyId: args.get("company-id") ?? undefined,
    teamId: args.get("team-id") ?? undefined,
    employeeId: args.get("employee-id") ?? undefined,
    runId: args.get("run-id") ?? undefined,
  };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function parsePositiveInt(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --${name}: ${value}`);
  }
  return parsed;
}

function parseBoolean(value: string): boolean {
  return ["1", "true", "yes", "y", "on"].includes(value.toLowerCase());
}

function isObject(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function ensureObject(value: unknown, context: string): JsonRecord {
  if (!isObject(value)) {
    fail(`${context}: expected JSON object`);
  }
  return value;
}

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function pass(message: string): void {
  console.log(`✅ ${message}`);
}

function info(message: string): void {
  console.log(`ℹ️  ${message}`);
}

function warn(message: string): void {
  console.warn(`WARN - ${message}`);
}

async function fetchJson(args: {
  baseUrl: string;
  path: string;
  timeoutMs: number;
}): Promise<{
  response: Response;
  body: unknown;
  url: string;
}> {
  const url = `${args.baseUrl}${args.path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "user-agent": "aep-ci-runtime-read-safety/1.0",
        "cache-control": "no-cache",
      },
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      const text = await response.text().catch(() => "");
      fail(
        [
          `GET ${args.path} returned non-JSON content-type: ${contentType || "(missing)"}`,
          text ? `Body:\n${text}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fail(`GET ${args.path} returned invalid JSON: ${message}`);
    }

    return { response, body, url };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`GET ${args.path} failed: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

function assertHasKeys(
  body: JsonRecord,
  keys: string[],
  context: string,
): void {
  for (const key of keys) {
    if (!(key in body)) {
      fail(`${context}: missing top-level key '${key}'`);
    }
  }
}

function assertErrorBody(
  body: JsonRecord,
  expectedError: string,
  context: string,
): void {
  if (body["error"] !== expectedError) {
    fail(
      `${context}: expected error='${expectedError}', got '${String(
        body["error"],
      )}'`,
    );
  }

  if (!("message" in body) && expectedError === "not_found") {
    fail(`${context}: expected 'message' field for not_found response`);
  }
}

async function runRouteCheck(args: {
  options: CliOptions;
  check: RouteCheck;
}): Promise<void> {
  const { response, body } = await fetchJson({
    baseUrl: args.options.baseUrl,
    path: args.check.path,
    timeoutMs: args.options.timeoutMs,
  });

  if (response.status !== args.check.expectedStatus) {
    fail(
      `${args.check.name}: expected HTTP ${args.check.expectedStatus}, got ${response.status}`,
    );
  }

  const objectBody = ensureObject(body, args.check.name);

  if (args.check.requiredKeys) {
    assertHasKeys(objectBody, args.check.requiredKeys, args.check.name);
  }

  if (args.check.expectedError) {
    assertErrorBody(objectBody, args.check.expectedError, args.check.name);
  }

  pass(args.check.name);
}

async function resolveRunId(options: CliOptions): Promise<string | null> {
  if (options.runId) {
    return options.runId;
  }

  const { response, body } = await fetchJson({
    baseUrl: options.baseUrl,
    path: "/runs?limit=1",
    timeoutMs: options.timeoutMs,
  });

  if (response.status !== 200) {
    warn(`Could not auto-resolve run id from /runs?limit=1 (status ${response.status})`);
    return null;
  }

  const objectBody = ensureObject(body, "resolve run id");
  const runs = objectBody["runs"];

  if (!Array.isArray(runs) || runs.length === 0) {
    warn("Could not auto-resolve run id: /runs returned no runs");
    return null;
  }

  const first = runs[0];
  if (!isObject(first) || !isString(first["run_id"]) || first["run_id"].trim() === "") {
    warn("Could not auto-resolve run id: first run missing run_id");
    return null;
  }

  return first["run_id"].trim();
}

function requiredValue(value: string | undefined, name: string): string {
  if (!value || value.trim() === "") {
    throw new Error(`Missing required identifier for validation: ${name}`);
  }
  return value.trim();
}

async function validateHappyPath(options: CliOptions): Promise<void> {
  info("Happy-path validation");

  const tenantId = requiredValue(options.tenantId, "--tenant-id");
  const serviceId = requiredValue(options.serviceId, "--service-id");
  const companyId = requiredValue(options.companyId, "--company-id");
  const teamId = requiredValue(options.teamId, "--team-id");
  const employeeId = requiredValue(options.employeeId, "--employee-id");

  const runId = await resolveRunId(options);
  if (!runId) {
    fail(
      "Happy-path validation needs a real run id. Pass --run-id explicitly or ensure /runs returns at least one run.",
    );
  }

  const checks: RouteCheck[] = [
    {
      name: "/runs happy path",
      path: "/runs",
      expectedStatus: 200,
      requiredKeys: ["runs"],
    },
    {
      name: "/runs/:id happy path",
      path: `/runs/${encodeURIComponent(runId)}`,
      expectedStatus: 200,
      requiredKeys: ["run_id", "steps", "jobs"],
    },
    {
      name: "/runs/:id/summary happy path",
      path: `/runs/${encodeURIComponent(runId)}/summary`,
      expectedStatus: 200,
      requiredKeys: ["run_id"],
    },
    {
      name: "/runs/:id/jobs happy path",
      path: `/runs/${encodeURIComponent(runId)}/jobs`,
      expectedStatus: 200,
      requiredKeys: ["run_id", "jobs"],
    },
    {
      name: "/runs/:id/failure happy path",
      path: `/runs/${encodeURIComponent(runId)}/failure`,
      expectedStatus: 200,
      requiredKeys: ["run_id", "failure"],
    },
    {
      name: "/tenants happy path",
      path: "/tenants",
      expectedStatus: 200,
      requiredKeys: ["tenants"],
    },
    {
      name: "/tenants/:tenantId happy path",
      path: `/tenants/${encodeURIComponent(tenantId)}`,
      expectedStatus: 200,
      requiredKeys: ["tenant", "services"],
    },
    {
      name: "/tenants/:tenantId/services happy path",
      path: `/tenants/${encodeURIComponent(tenantId)}/services`,
      expectedStatus: 200,
      requiredKeys: ["tenant_id", "services"],
    },
    {
      name: "/tenants/:tenantId/services/:serviceId happy path",
      path: `/tenants/${encodeURIComponent(tenantId)}/services/${encodeURIComponent(serviceId)}`,
      expectedStatus: 200,
      requiredKeys: ["tenant", "service", "environments"],
    },
    {
      name: "/companies happy path",
      path: "/companies",
      expectedStatus: 200,
      requiredKeys: ["companies"],
    },
    {
      name: "/companies/:companyId happy path",
      path: `/companies/${encodeURIComponent(companyId)}`,
      expectedStatus: 200,
    },
    {
      name: "/teams happy path",
      path: "/teams",
      expectedStatus: 200,
      requiredKeys: ["teams"],
    },
    {
      name: "/teams/:teamId happy path",
      path: `/teams/${encodeURIComponent(teamId)}`,
      expectedStatus: 200,
    },
    {
      name: "/org/tenants happy path",
      path: "/org/tenants",
      expectedStatus: 200,
      requiredKeys: ["tenants"],
    },
    {
      name: "/org/tenants/:tenantId happy path",
      path: `/org/tenants/${encodeURIComponent(tenantId)}`,
      expectedStatus: 200,
    },
    {
      name: "/org/tenants/:tenantId/environments happy path",
      path: `/org/tenants/${encodeURIComponent(tenantId)}/environments`,
      expectedStatus: 200,
      requiredKeys: ["tenant_id", "environments"],
    },
    {
      name: "/services happy path",
      path: "/services",
      expectedStatus: 200,
      requiredKeys: ["services"],
    },
    {
      name: "/services/:serviceId happy path",
      path: `/services/${encodeURIComponent(serviceId)}`,
      expectedStatus: 200,
    },
    {
      name: "/employees happy path",
      path: "/employees",
      expectedStatus: 200,
      requiredKeys: ["employees"],
    },
    {
      name: "/employees/:employeeId happy path",
      path: `/employees/${encodeURIComponent(employeeId)}`,
      expectedStatus: 200,
    },
    {
      name: "/employees/:employeeId/scope happy path",
      path: `/employees/${encodeURIComponent(employeeId)}/scope`,
      expectedStatus: 200,
      requiredKeys: ["employee_id", "scope_bindings"],
    },
  ];

  for (const check of checks) {
    await runRouteCheck({ options, check });
  }
}

async function validateNotFound(options: CliOptions): Promise<void> {
  info("Not-found validation");

  const checks: RouteCheck[] = [
    {
      name: "/runs/:missing returns JSON 404",
      path: "/runs/run_missing_14_1",
      expectedStatus: 404,
      expectedError: "not_found",
    },
    {
      name: "/runs/:missing/summary returns JSON 404",
      path: "/runs/run_missing_14_1/summary",
      expectedStatus: 404,
      expectedError: "not_found",
    },
    {
      name: "/runs/:missing/jobs returns JSON 404",
      path: "/runs/run_missing_14_1/jobs",
      expectedStatus: 404,
      expectedError: "not_found",
    },
    {
      name: "/runs/:missing/failure returns JSON 404",
      path: "/runs/run_missing_14_1/failure",
      expectedStatus: 404,
      expectedError: "not_found",
    },
    {
      name: "/tenants/:missing returns JSON 404",
      path: "/tenants/tenant_missing_14_1",
      expectedStatus: 404,
      expectedError: "not_found",
    },
    {
      name: "/tenants/:missing/services/:missing returns JSON 404",
      path: "/tenants/tenant_missing_14_1/services/service_missing_14_1",
      expectedStatus: 404,
      expectedError: "not_found",
    },
    {
      name: "/companies/:missing returns JSON 404",
      path: "/companies/company_missing_14_1",
      expectedStatus: 404,
      expectedError: "not_found",
    },
    {
      name: "/teams/:missing returns JSON 404",
      path: "/teams/team_missing_14_1",
      expectedStatus: 404,
      expectedError: "not_found",
    },
    {
      name: "/org/tenants/:missing returns JSON 404",
      path: "/org/tenants/tenant_missing_14_1",
      expectedStatus: 404,
      expectedError: "not_found",
    },
    {
      name: "/services/:missing returns JSON 404",
      path: "/services/service_missing_14_1",
      expectedStatus: 404,
      expectedError: "not_found",
    },
    {
      name: "/employees/:missing returns JSON 404",
      path: "/employees/employee_missing_14_1",
      expectedStatus: 404,
      expectedError: "not_found",
    },
    {
      name: "/employees/:missing/scope returns JSON 404",
      path: "/employees/employee_missing_14_1/scope",
      expectedStatus: 404,
      expectedError: "not_found",
    },
  ];

  for (const check of checks) {
    await runRouteCheck({ options, check });
  }
}

async function validateForcedFailure(options: CliOptions): Promise<void> {
  info("Forced-failure validation");

  const token = encodeURIComponent(options.forcedFailureToken);

  const checks: RouteCheck[] = [
    {
      name: "forced /runs failure returns structured JSON 500",
      path: `/runs?fail=${token}`,
      expectedStatus: 500,
      expectedError: "runtime_projection_failed",
    },
    {
      name: "forced /tenants failure returns structured JSON 500",
      path: `/tenants?fail=${token}`,
      expectedStatus: 500,
      expectedError: "runtime_projection_failed",
    },
    {
      name: "forced /companies failure returns structured JSON 500",
      path: `/companies?fail=${token}`,
      expectedStatus: 500,
      expectedError: "runtime_projection_failed",
    },
  ];

  for (const check of checks) {
    await runRouteCheck({ options, check });
  }
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const options = parseArgs(process.argv.slice(2));

  console.log("🔎 AEP runtime/read safety validation");
  console.log(`   Base URL:              ${options.baseUrl}`);
  console.log(`   Timeout:               ${options.timeoutMs}ms`);
  console.log(`   Skip happy path:       ${String(options.skipHappy)}`);
  console.log(`   Skip not-found:        ${String(options.skipNotFound)}`);
  console.log(`   Check forced failure:  ${String(options.checkForcedFailure)}`);
  console.log(`   Forced failure token:  ${options.forcedFailureToken}`);

  if (!options.skipHappy) {
    await validateHappyPath(options);
  } else {
    warn("Skipping happy-path validation");
  }

  if (!options.skipNotFound) {
    await validateNotFound(options);
  } else {
    warn("Skipping not-found validation");
  }

  if (options.checkForcedFailure) {
    await validateForcedFailure(options);
  } else {
    warn("Skipping forced-failure validation");
  }

  const elapsedMs = Date.now() - startedAt;
  console.log("🎉 Commit 14.1 validation passed");
  console.log(`   Total time: ${elapsedMs}ms`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  fail(`Unhandled error:\n${message}`);
});