#!/usr/bin/env node

/**
 * scripts/ci/smoke-test.ts
 * A generic smoke test script for testing deployed HTTP endpoints.
 * 
 * This script is intentionally generic:
 * - it calls a real deployed HTTP endpoint
 * - validates status code
 * - validates JSON shape
 * - optionally polls a follow-up status endpoint
 * - can send bearer auth and custom headers
 *
 * Default mode:
 * - POST {baseUrl}/api/smoke
 *
 * Typical usage:
 *
 *   npx tsx scripts/ci/smoke-test.ts \
 *     --base-url https://staging.example.com \
 *     --env staging
 *
 * More realistic usage:
 *
 *   npx tsx scripts/ci/smoke-test.ts \
 *     --base-url https://staging.example.com \
 *     --env staging \
 *     --method POST \
 *     --path /workflow/start \
 *     --payload '{"tenant_id":"t_demo","project_id":"p_demo","repo_url":"https://github.com/example/repo","branch":"main","service_name":"sample-worker"}' \
 *     --expect-status 200 \
 *     --expect-json-key workflow_run_id
 *
 * Async poll usage:
 *
 *   npx tsx scripts/ci/smoke-test.ts \
 *     --base-url https://staging.example.com \
 *     --env staging \
 *     --method POST \
 *     --path /workflow/start \
 *     --payload '{"tenant_id":"t_demo","project_id":"p_demo","repo_url":"https://github.com/example/repo","branch":"main","service_name":"sample-worker"}' \
 *     --expect-status 200 \
 *     --expect-json-key workflow_run_id \
 *     --poll-path-template /workflow/status/{id} \
 *     --poll-id-key workflow_run_id \
 *     --poll-success-key status \
 *     --poll-success-values succeeded,completed,ok \
 *     --poll-failure-values failed,error \
 *     --poll-attempts 20 \
 *     --poll-interval-ms 3000
 *
 * Auth:
 *   --bearer-token <token>
 *
 * Extra headers:
 *   --header x-smoke-test=true
 *   --header x-run-source=github-actions
 *
 * Exit codes:
 *   0 = success
 *   1 = failure
 */

type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

type CliOptions = {
  baseUrl: string;
  env?: string;
  method: string;
  path: string;
  payload?: string;
  timeoutMs: number;
  expectStatus: number[];
  expectJsonKey?: string;
  expectJsonValue?: string;
  bearerToken?: string;
  headers: Record<string, string>;

  pollPathTemplate?: string;
  pollIdKey?: string;
  pollSuccessKey?: string;
  pollSuccessValues: string[];
  pollFailureValues: string[];
  pollAttempts: number;
  pollIntervalMs: number;
};

type RequestResult = {
  status: number;
  statusText: string;
  headers: Headers;
  bodyText: string;
  bodyJson?: unknown;
  durationMs: number;
};

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function parseBoolean(value: string): boolean {
  return ["1", "true", "yes", "y", "on"].includes(value.toLowerCase());
}

function parsePositiveInt(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --${name}: ${value}`);
  }
  return parsed;
}

function parseCsv(value?: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeHeaderName(name: string): string {
  return name.trim().toLowerCase();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeJsonParse(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function getNestedValue(source: unknown, dottedPath: string): unknown {
  if (!dottedPath) return undefined;

  const parts = dottedPath.split(".").map((p) => p.trim()).filter(Boolean);
  let current: unknown = source;

  for (const part of parts) {
    if (!isObject(current)) return undefined;
    current = current[part];
  }

  return current;
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildDefaultPayload(runId: string, env?: string): string {
  return JSON.stringify({
    type: "smoke",
    run_id: runId,
    env: env ?? "unknown",
    source: "aep-ci",
    payload: {
      ping: true,
      timestamp: new Date().toISOString(),
    },
  });
}

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string>();
  const headers: Record<string, string> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--header") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error("Missing value for --header. Expected key=value.");
      }

      const eqIndex = next.indexOf("=");
      if (eqIndex <= 0) {
        throw new Error(`Invalid --header value '${next}'. Expected key=value.`);
      }

      const key = normalizeHeaderName(next.slice(0, eqIndex));
      const value = next.slice(eqIndex + 1);
      headers[key] = value;
      i += 1;
      continue;
    }

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
        "  npx tsx scripts/ci/smoke-test.ts --base-url https://staging.example.com --env staging",
      ].join("\n"),
    );
  }

  const method = (args.get("method") ?? "POST").toUpperCase();
  const path = args.get("path") ?? "/api/smoke";

  let expectStatus = parseCsv(args.get("expect-status")).map((v) => parsePositiveInt(v, "expect-status"));
  if (expectStatus.length === 0) {
    expectStatus = [200, 201, 202];
  }

  return {
    baseUrl,
    env: args.get("env"),
    method,
    path,
    payload: args.get("payload"),
    timeoutMs: parsePositiveInt(args.get("timeout-ms") ?? "15000", "timeout-ms"),
    expectStatus,
    expectJsonKey: args.get("expect-json-key"),
    expectJsonValue: args.get("expect-json-value"),
    bearerToken: args.get("bearer-token"),
    headers,

    pollPathTemplate: args.get("poll-path-template"),
    pollIdKey: args.get("poll-id-key"),
    pollSuccessKey: args.get("poll-success-key"),
    pollSuccessValues: parseCsv(args.get("poll-success-values")),
    pollFailureValues: parseCsv(args.get("poll-failure-values")),
    pollAttempts: parsePositiveInt(args.get("poll-attempts") ?? "15", "poll-attempts"),
    pollIntervalMs: parsePositiveInt(args.get("poll-interval-ms") ?? "2000", "poll-interval-ms"),
  };
}

async function requestJson(options: {
  url: string;
  method: string;
  timeoutMs: number;
  headers?: Record<string, string>;
  body?: string;
}): Promise<RequestResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(options.url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });

    const bodyText = await response.text();
    const bodyJson = safeJsonParse(bodyText);

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      bodyText,
      bodyJson,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

function validateMainResponse(result: RequestResult, cli: CliOptions): void {
  if (!cli.expectStatus.includes(result.status)) {
    fail(
      `Smoke endpoint returned unexpected HTTP status ${result.status} ${result.statusText}. ` +
        `Expected one of: ${cli.expectStatus.join(", ")}.\nBody:\n${result.bodyText}`,
    );
  }

  if (cli.expectJsonKey) {
    if (result.bodyJson === undefined) {
      fail(
        `Expected JSON response containing key '${cli.expectJsonKey}', but response body was not valid JSON.\n` +
          `Body:\n${result.bodyText}`,
      );
    }

    const actual = getNestedValue(result.bodyJson, cli.expectJsonKey);
    if (actual === undefined) {
      fail(
        `Expected JSON key '${cli.expectJsonKey}' was missing.\n` +
          `Body:\n${JSON.stringify(result.bodyJson, null, 2)}`,
      );
    }

    if (cli.expectJsonValue !== undefined) {
      const actualString = stringifyValue(actual);
      if (actualString !== cli.expectJsonValue) {
        fail(
          `JSON key '${cli.expectJsonKey}' mismatch. Expected '${cli.expectJsonValue}', got '${actualString}'.`,
        );
      }
    }
  }
}

function buildHeaders(cli: CliOptions, runId: string): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": "aep-ci-smoke-test/1.0",
    "cache-control": "no-cache",
    "x-smoke-test": "true",
    "x-smoke-run-id": runId,
    ...cli.headers,
  };

  if (cli.method !== "GET" && cli.method !== "HEAD") {
    headers["content-type"] = headers["content-type"] ?? "application/json";
  }

  if (cli.env) {
    headers["x-aep-env"] = cli.env;
  }

  if (cli.bearerToken) {
    headers.authorization = `Bearer ${cli.bearerToken}`;
  }

  return headers;
}

function resolvePollUrl(result: RequestResult, cli: CliOptions): string {
  if (!cli.pollPathTemplate) {
    fail("Internal error: resolvePollUrl called without --poll-path-template.");
  }

  if (!result.bodyJson) {
    fail(
      "Polling was requested but the initial response was not valid JSON. " +
        "Cannot extract id for poll path.",
    );
  }

  if (!cli.pollIdKey) {
    fail("Polling was requested but --poll-id-key was not provided.");
  }

  const idValue = getNestedValue(result.bodyJson, cli.pollIdKey);
  if (idValue === undefined || idValue === null || String(idValue).trim() === "") {
    fail(
      `Polling was requested but id key '${cli.pollIdKey}' was missing or empty in initial response.`,
    );
  }

  const id = encodeURIComponent(String(idValue));
  const path = cli.pollPathTemplate.replaceAll("{id}", id);
  return joinUrl(cli.baseUrl, path);
}

async function runPolling(
  cli: CliOptions,
  runId: string,
  pollUrl: string,
  headers: Record<string, string>,
): Promise<void> {
  if (!cli.pollSuccessKey) {
    fail("Polling was requested but --poll-success-key was not provided.");
  }

  console.log("⏳ Polling for async smoke completion");
  console.log(`   URL:      ${pollUrl}`);
  console.log(`   Key:      ${cli.pollSuccessKey}`);
  console.log(`   Attempts: ${cli.pollAttempts}`);
  console.log(`   Interval: ${cli.pollIntervalMs}ms`);

  for (let attempt = 1; attempt <= cli.pollAttempts; attempt += 1) {
    const result = await requestJson({
      url: pollUrl,
      method: "GET",
      timeoutMs: cli.timeoutMs,
      headers,
    });

    const jsonPretty =
      result.bodyJson !== undefined
        ? JSON.stringify(result.bodyJson, null, 2)
        : result.bodyText;

    if (result.status < 200 || result.status >= 300) {
      console.warn(
        `⚠️  Poll attempt ${attempt}/${cli.pollAttempts} returned ${result.status} ${result.statusText}`,
      );
      console.warn(jsonPretty);
    } else {
      const stateValue = getNestedValue(result.bodyJson, cli.pollSuccessKey);
      const state = stringifyValue(stateValue);

      console.log(
        `   Attempt ${attempt}/${cli.pollAttempts}: status=${result.status}, ${cli.pollSuccessKey}=${state}, time=${result.durationMs}ms`,
      );

      if (cli.pollFailureValues.includes(state)) {
        fail(
          `Smoke poll entered failure state '${state}'.\nResponse:\n${jsonPretty}`,
        );
      }

      if (cli.pollSuccessValues.length === 0) {
        if (stateValue !== undefined && stateValue !== null && state !== "") {
          console.log("✅ Smoke poll completed with non-empty success key");
          return;
        }
      } else if (cli.pollSuccessValues.includes(state)) {
        console.log("✅ Smoke poll completed successfully");
        return;
      }
    }

    if (attempt < cli.pollAttempts) {
      await sleep(cli.pollIntervalMs);
    }
  }

  fail(
    `Smoke poll did not reach a success state after ${cli.pollAttempts} attempts.`,
  );
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const cli = parseArgs(process.argv.slice(2));

  const runId = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const url = joinUrl(cli.baseUrl, cli.path);
  const headers = buildHeaders(cli, runId);

  const body =
    cli.method === "GET" || cli.method === "HEAD"
      ? undefined
      : cli.payload ?? buildDefaultPayload(runId, cli.env);

  console.log("🚬 AEP CI smoke test");
  console.log(`   Run ID:   ${runId}`);
  console.log(`   Env:      ${cli.env ?? "(not enforced)"}`);
  console.log(`   Method:   ${cli.method}`);
  console.log(`   URL:      ${url}`);
  console.log(`   Timeout:  ${cli.timeoutMs}ms`);
  console.log(`   Expect:   HTTP ${cli.expectStatus.join(", ")}`);
  if (cli.expectJsonKey) {
    console.log(`   JSON key: ${cli.expectJsonKey}`);
  }

  let result: RequestResult;
  try {
    result = await requestJson({
      url,
      method: cli.method,
      timeoutMs: cli.timeoutMs,
      headers,
      body,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error while calling smoke endpoint";
    fail(`Smoke request failed: ${message}`);
  }

  console.log(`   Response: HTTP ${result.status} ${result.statusText} (${result.durationMs}ms)`);

  validateMainResponse(result, cli);

  if (result.bodyJson !== undefined) {
    console.log("✅ Initial smoke request passed");
  } else {
    console.log("✅ Initial smoke request passed (non-JSON body)");
  }

  if (cli.pollPathTemplate) {
    const pollUrl = resolvePollUrl(result, cli);
    await runPolling(cli, runId, pollUrl, headers);
  }

  const totalDurationMs = Date.now() - startedAt;
  console.log(`✅ Smoke test passed in ${totalDurationMs}ms`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  fail(`Unhandled error:\n${message}`);
});