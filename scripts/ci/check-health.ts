#!/usr/bin/env node

/**
 * scripts/ci/check-health.ts
 * A script to validate the health of a deployed service by calling its /healthz endpoint and checking the response.
 * 
 * Usage:
 *   npx tsx scripts/ci/check-health.ts \
 *     --url https://staging.example.com/healthz \
 *     --env staging \
 *     --sha 0123456789abcdef \
 *     --service control-plane
 *
 * Optional:
 *   --timeout-ms 10000
 *   --expect-version true
 *   --insecure-allow-version-mismatch true
 *
 * Exit codes:
 *   0 = success
 *   1 = failed validation / request error
 *
 * Expected endpoint behavior:
 * - HTTP 200 when healthy
 * - JSON body with at least:
 *   {
 *     "ok": true,
 *     "service": "control-plane",
 *     "env": "staging",
 *     "version": "0123456",
 *     "checks": {
 *       "config": "ok",
 *       "runtime": "ok"
 *     }
 *   }
 */

type HealthStatus = "ok" | "fail" | "unknown";

type HealthResponse = {
  ok?: boolean;
  service?: string;
  env?: string;
  version?: string;
  checks?: Record<string, HealthStatus | string | boolean | null>;
  [key: string]: unknown;
};

type CliOptions = {
  url: string;
  env?: string;
  sha?: string;
  service?: string;
  timeoutMs: number;
  expectVersion: boolean;
  insecureAllowVersionMismatch: boolean;
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

  const url = args.get("url");
  if (!url) {
    throw new Error(
      [
        "Missing required argument: --url",
        "Example:",
        "  npx tsx scripts/ci/check-health.ts --url https://staging.example.com/healthz --env staging --sha 0123456789abcdef --service control-plane",
      ].join("\n"),
    );
  }

  return {
    url,
    env: args.get("env"),
    sha: args.get("sha"),
    service: args.get("service"),
    timeoutMs: parsePositiveInt(args.get("timeout-ms") ?? "10000", "timeout-ms"),
    expectVersion: parseBoolean(args.get("expect-version") ?? "true"),
    insecureAllowVersionMismatch: parseBoolean(
      args.get("insecure-allow-version-mismatch") ?? "false",
    ),
  };
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

function normalizeSha(sha?: string): string | undefined {
  if (!sha) return undefined;
  return sha.trim().toLowerCase();
}

function shortSha(sha?: string): string | undefined {
  const normalized = normalizeSha(sha);
  if (!normalized) return undefined;
  return normalized.slice(0, 7);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function summarizeChecks(checks: HealthResponse["checks"]): string {
  if (!checks || !isObject(checks)) return "(none)";
  return Object.entries(checks)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(", ");
}

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "user-agent": "aep-ci-health-check/1.0",
        "cache-control": "no-cache",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function validateVersion(
  actualVersion: string | undefined,
  expectedSha: string | undefined,
  allowMismatch: boolean,
): void {
  if (!expectedSha) return;

  const expectedFull = normalizeSha(expectedSha);
  const expectedShort = shortSha(expectedSha);

  if (!actualVersion) {
    fail(
      "Health response is missing 'version' while --sha was provided. " +
        "Either expose build version in /healthz or pass --expect-version false.",
    );
  }

  const actual = actualVersion.trim().toLowerCase();

  const matches =
    actual === expectedFull ||
    actual === expectedShort ||
    actual.startsWith(expectedShort ?? "") ||
    (expectedFull?.startsWith(actual) ?? false);

  if (matches) return;

  const message =
    `Version mismatch. Expected SHA '${expectedFull}' (or prefix '${expectedShort}'), got '${actualVersion}'.`;

  if (allowMismatch) {
    console.warn(`⚠️  ${message}`);
    return;
  }

  fail(message);
}

function validateChecks(checks: HealthResponse["checks"]): void {
  if (!checks) {
    console.warn("⚠️  Health response has no 'checks' object.");
    return;
  }

  if (!isObject(checks)) {
    fail("Health response field 'checks' is not an object.");
  }

  const failingChecks = Object.entries(checks).filter(([, value]) => {
    if (typeof value === "string") {
      return value.toLowerCase() === "fail";
    }
    if (typeof value === "boolean") {
      return value === false;
    }
    return false;
  });

  if (failingChecks.length > 0) {
    const details = failingChecks.map(([k, v]) => `${k}=${String(v)}`).join(", ");
    fail(`Health response includes failing checks: ${details}`);
  }
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const options = parseArgs(process.argv.slice(2));

  console.log("🔎 AEP CI health check");
  console.log(`   URL:     ${options.url}`);
  console.log(`   Env:     ${options.env ?? "(not enforced)"}`);
  console.log(`   Service: ${options.service ?? "(not enforced)"}`);
  console.log(`   SHA:     ${options.sha ?? "(not enforced)"}`);
  console.log(`   Timeout: ${options.timeoutMs}ms`);

  let response: Response;
  try {
    response = await fetchWithTimeout(options.url, options.timeoutMs);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error while calling health endpoint";
    fail(`Request failed: ${message}`);
  }

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    fail(
      `Health endpoint returned HTTP ${response.status} ${response.statusText}` +
        (responseText ? `\nBody:\n${responseText}` : ""),
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    console.warn(`⚠️  Unexpected content-type: ${contentType || "(missing)"}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error";
    fail(`Health endpoint did not return valid JSON: ${message}`);
  }

  if (!isObject(body)) {
    fail("Health response is not a JSON object.");
  }

  const health = body as HealthResponse;

  if (health.ok !== true) {
    fail(`Health response has ok=${String(health.ok)} instead of true.`);
  }

  if (options.env && health.env !== options.env) {
    fail(`Environment mismatch. Expected env='${options.env}', got env='${String(health.env)}'.`);
  }

  if (options.service && health.service !== options.service) {
    fail(
      `Service mismatch. Expected service='${options.service}', got service='${String(
        health.service,
      )}'.`,
    );
  }

  if (options.expectVersion) {
    validateVersion(health.version, options.sha, options.insecureAllowVersionMismatch);
  }

  validateChecks(health.checks);

  const durationMs = Date.now() - startedAt;

  console.log("✅ Health check passed");
  console.log(`   HTTP:    ${response.status}`);
  console.log(`   ok:      ${String(health.ok)}`);
  console.log(`   service: ${String(health.service ?? "(missing)")}`);
  console.log(`   env:     ${String(health.env ?? "(missing)")}`);
  console.log(`   version: ${String(health.version ?? "(missing)")}`);
  console.log(`   checks:  ${summarizeChecks(health.checks)}`);
  console.log(`   time:    ${durationMs}ms`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  fail(`Unhandled error:\n${message}`);
});