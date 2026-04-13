#!/usr/bin/env node

/**
 * scripts/ci/checks/environment/wait-for-url.ts
 * A simple script to poll a public URL until it becomes ready, with configurable expectations and timeouts.
 * 
 * Purpose:
 * - wait for a deployed public URL to become reachable before health/smoke checks
 * - tolerate edge propagation / cold start / route warmup
 * - fail clearly if the URL never becomes ready
 *
 * Typical usage:
 *
 *   npx tsx scripts/ci/checks/environment/wait-for-url.ts \
 *     --url https://staging.example.com/healthz
 *
 * With stricter rules:
 *
 *   npx tsx scripts/ci/checks/environment/wait-for-url.ts \
 *     --url https://staging.example.com/healthz \
 *     --expect-status 200 \
 *     --expect-body-substring '"ok":true' \
 *     --attempts 24 \
 *     --interval-ms 5000 \
 *     --timeout-ms 8000
 *
 * GET is default. HEAD can be useful if your endpoint supports it:
 *
 *   npx tsx scripts/ci/checks/environment/wait-for-url.ts \
 *     --url https://staging.example.com/healthz \
 *     --method HEAD
 *
 * Exit codes:
 *   0 = success
 *   1 = failure
 */

type CliOptions = {
  url: string;
  method: "GET" | "HEAD";
  timeoutMs: number;
  attempts: number;
  intervalMs: number;
  initialDelayMs: number;
  expectStatus: number[];
  expectBodySubstring?: string;
  allowRedirects: boolean;
};

export {};

type AttemptResult = {
  ok: boolean;
  status?: number;
  statusText?: string;
  bodyText?: string;
  durationMs: number;
  error?: string;
};

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function parsePositiveInt(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --${name}: ${value}`);
  }
  return parsed;
}

function parseNonNegativeInt(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid --${name}: ${value}`);
  }
  return parsed;
}

function parseCsvInts(value?: string, fallback: number[] = [200]): number[] {
  if (!value) return fallback;
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => parsePositiveInt(part, "expect-status"));
}

function parseBoolean(value: string): boolean {
  return ["1", "true", "yes", "y", "on"].includes(value.toLowerCase());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
        "  npx tsx scripts/ci/checks/environment/wait-for-url.ts --url https://staging.example.com/healthz",
      ].join("\n"),
    );
  }

  const rawMethod = (args.get("method") ?? "GET").toUpperCase();
  if (rawMethod !== "GET" && rawMethod !== "HEAD") {
    throw new Error(`Invalid --method '${rawMethod}'. Allowed: GET, HEAD`);
  }

  return {
    url,
    method: rawMethod as "GET" | "HEAD",
    timeoutMs: parsePositiveInt(args.get("timeout-ms") ?? "8000", "timeout-ms"),
    attempts: parsePositiveInt(args.get("attempts") ?? "24", "attempts"),
    intervalMs: parsePositiveInt(args.get("interval-ms") ?? "5000", "interval-ms"),
    initialDelayMs: parseNonNegativeInt(args.get("initial-delay-ms") ?? "0", "initial-delay-ms"),
    expectStatus: parseCsvInts(args.get("expect-status"), [200]),
    expectBodySubstring: args.get("expect-body-substring"),
    allowRedirects: parseBoolean(args.get("allow-redirects") ?? "false"),
  };
}

async function requestWithTimeout(options: {
  url: string;
  method: "GET" | "HEAD";
  timeoutMs: number;
  allowRedirects: boolean;
}): Promise<AttemptResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(options.url, {
      method: options.method,
      headers: {
        accept: "*/*",
        "user-agent": "aep-ci-wait-for-url/1.0",
        "cache-control": "no-cache",
      },
      redirect: options.allowRedirects ? "follow" : "manual",
      signal: controller.signal,
    });

    const bodyText =
      options.method === "HEAD" ? "" : await response.text().catch(() => "");

    return {
      ok: true,
      status: response.status,
      statusText: response.statusText,
      bodyText,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: message,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

function validateAttempt(result: AttemptResult, cli: CliOptions): { success: boolean; reason: string } {
  if (!result.ok) {
    return {
      success: false,
      reason: `request error: ${result.error ?? "unknown error"}`,
    };
  }

  if (result.status === undefined) {
    return {
      success: false,
      reason: "missing HTTP status",
    };
  }

  if (!cli.expectStatus.includes(result.status)) {
    return {
      success: false,
      reason: `unexpected status ${result.status}, expected one of [${cli.expectStatus.join(", ")}]`,
    };
  }

  if (cli.expectBodySubstring && cli.method !== "HEAD") {
    const haystack = result.bodyText ?? "";
    if (!haystack.includes(cli.expectBodySubstring)) {
      return {
        success: false,
        reason: `response body missing expected substring: ${JSON.stringify(cli.expectBodySubstring)}`,
      };
    }
  }

  return {
    success: true,
    reason: "ready",
  };
}

function truncate(text: string, maxLength = 300): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function isCloudflarePlaceholder404(result: AttemptResult): boolean {
  if (result.status !== 404) {
    return false;
  }

  const body = result.bodyText ?? "";
  return (
    body.includes("<!DOCTYPE html") &&
    (body.includes("There is nothing here yet") || body.includes("Powered by"))
  );
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const cli = parseArgs(process.argv.slice(2));

  console.log("⏳ AEP CI wait-for-url");
  console.log(`   URL:           ${cli.url}`);
  console.log(`   Method:        ${cli.method}`);
  console.log(`   Timeout:       ${cli.timeoutMs}ms`);
  console.log(`   Attempts:      ${cli.attempts}`);
  console.log(`   Interval:      ${cli.intervalMs}ms`);
  console.log(`   Initial delay: ${cli.initialDelayMs}ms`);
  console.log(`   Expect status: ${cli.expectStatus.join(", ")}`);
  if (cli.expectBodySubstring) {
    console.log(`   Expect body:   ${JSON.stringify(cli.expectBodySubstring)}`);
  }
  console.log(`   Redirects:     ${cli.allowRedirects ? "follow" : "manual"}`);

  if (cli.initialDelayMs > 0) {
    await sleep(cli.initialDelayMs);
  }

  let lastFailureReason = "unknown failure";
  let sawCloudflarePlaceholder404 = false;

  for (let attempt = 1; attempt <= cli.attempts; attempt += 1) {
    const result = await requestWithTimeout({
      url: cli.url,
      method: cli.method,
      timeoutMs: cli.timeoutMs,
      allowRedirects: cli.allowRedirects,
    });

    const validation = validateAttempt(result, cli);

    if (validation.success) {
      const totalDurationMs = Date.now() - startedAt;
      console.log(
        `✅ URL became ready on attempt ${attempt}/${cli.attempts} in ${totalDurationMs}ms`,
      );
      if (result.status !== undefined) {
        console.log(`   HTTP: ${result.status} ${result.statusText ?? ""}`.trim());
      }
      console.log(`   Last request time: ${result.durationMs}ms`);
      return;
    }

    lastFailureReason = validation.reason;

    if (isCloudflarePlaceholder404(result)) {
      sawCloudflarePlaceholder404 = true;
      lastFailureReason =
        "received Cloudflare placeholder 404 page; the public base URL/route is likely wrong or not attached to the deployed worker yet";
    }

    const statusText =
      result.status !== undefined
        ? `HTTP ${result.status}${result.statusText ? ` ${result.statusText}` : ""}`
        : "no HTTP response";

    console.warn(
      `⚠️  Attempt ${attempt}/${cli.attempts} not ready: ${statusText}; ${validation.reason}; ${result.durationMs}ms`,
    );

    if (result.bodyText) {
      console.warn(`   Body: ${truncate(result.bodyText)}`);
    }

    if (attempt < cli.attempts) {
      await sleep(cli.intervalMs);
    }
  }

  if (sawCloudflarePlaceholder404) {
    fail(
      `URL did not become ready after ${cli.attempts} attempts. Last failure: ${lastFailureReason}. ` +
        "Check the configured public base URL secret and confirm it points at the deployed worker route/workers.dev hostname."
    );
  }

  fail(
    `URL did not become ready after ${cli.attempts} attempts. Last failure: ${lastFailureReason}`,
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  fail(`Unhandled error:\n${message}`);
});