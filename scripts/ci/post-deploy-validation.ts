/* eslint-disable no-console */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

type ValidationCheck = {
  id: string;
  label: string;
  scriptPath: string;
  args?: string[];
};

type CheckStatus = "pass" | "fail" | "skip" | "warn";

type CheckResult = {
  check: ValidationCheck;
  exitCode: number;
  status: CheckStatus;
  skipReason?: string;
  warnReason?: string;
  dispatchBatchId?: string;
};

const CHECKS: ValidationCheck[] = [
  {
    id: "operator-surface",
    label: "Operator surface check",
    scriptPath: "scripts/ci/operator-surface-check.ts",
  },
  {
    id: "paperclip-first-execution",
    label: "Paperclip first execution check",
    scriptPath: "scripts/ci/paperclip-first-execution-check.ts",
  },
  {
    id: "scheduled-routing",
    label: "Scheduled routing check",
    scriptPath: "scripts/ci/scheduled-routing-check.ts",
  },
  {
    id: "dispatch-validation-runs",
    label: "Dispatch validation runs",
    scriptPath: "scripts/ci/dispatch-validation-runs.ts",
  },
  {
    id: "execute-validation-dispatch",
    label: "Execute dispatched validation runs",
    scriptPath: "scripts/ci/execute-validation-dispatch.ts",
  },
  {
    id: "validation-verdict",
    label: "Validation verdict check",
    scriptPath: "scripts/ci/check-validation-verdict.ts",
  },
  {
    id: "validation-policy",
    label: "Validation policy check",
    scriptPath: "scripts/ci/check-validation-policy.ts",
  },
];

function hasArg(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

function resolveTsxBin(): string {
  const localBin = resolve(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "tsx.cmd" : "tsx"
  );

  if (!existsSync(localBin)) {
    throw new Error(
      `Unable to find tsx executable at ${localBin}. Run npm ci before invoking post-deploy validation.`
    );
  }

  return localBin;
}

function requireBaseUrl(): string {
  const baseUrl = process.env.DEPLOY_URL;
  if (!baseUrl) {
    throw new Error(
      "DEPLOY_URL is required for post-deploy validation checks that call the deployed control-plane.",
    );
  }

  return baseUrl;
}

function extractSkipReason(output: string): string | undefined {
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[skip] ")) {
      return trimmed.slice("[skip] ".length).trim();
    }
  }
  return undefined;
}

function extractWarnReason(output: string): string | undefined {
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[warn] ")) {
      return trimmed.slice("[warn] ".length).trim();
    }
  }
  return undefined;
}

function extractDispatchBatchId(output: string): string | undefined {
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("DISPATCH_BATCH_ID=")) {
      return trimmed.slice("DISPATCH_BATCH_ID=".length).trim();
    }
  }
  return undefined;
}

function runCheck(tsxBin: string, check: ValidationCheck): CheckResult {
  console.log(`\n==> ${check.label}`);
  console.log(`Running ${check.scriptPath}`);

  const result = spawnSync(tsxBin, [check.scriptPath, ...(check.args ?? [])], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
    encoding: "utf8",
  });

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (stdout.length > 0) {
    process.stdout.write(stdout);
  }
  if (stderr.length > 0) {
    process.stderr.write(stderr);
  }

  if (typeof result.status === "number") {
    const combinedOutput = `${stdout}\n${stderr}`;
    const dispatchBatchId = extractDispatchBatchId(combinedOutput);
    const skipReason = extractSkipReason(combinedOutput);
    const warnReason = extractWarnReason(combinedOutput);

    if (result.status === 0 && skipReason) {
      return {
        check,
        exitCode: result.status,
        status: "skip",
        skipReason,
        dispatchBatchId,
      };
    }

    if (result.status === 0 && warnReason) {
      return {
        check,
        exitCode: result.status,
        status: "warn",
        warnReason,
        dispatchBatchId,
      };
    }

    return {
      check,
      exitCode: result.status,
      status: result.status === 0 ? "pass" : "fail",
      dispatchBatchId,
    };
  }

  if (result.error) {
    console.error(`Failed to launch ${check.scriptPath}`);
    console.error(result.error);
  }

  return { check, exitCode: 1, status: "fail" };
}

function main(): void {
  const baseUrl = requireBaseUrl();
  const checks = CHECKS.map((check) => {
    if (check.id === "validation-verdict") {
      return {
        ...check,
        args: ["--base-url", baseUrl, "--freshness-minutes", "30"],
      };
    }

    if (check.id === "validation-policy") {
      return {
        ...check,
        args: ["--base-url", baseUrl, "--freshness-minutes", "30"],
      };
    }

    if (check.id === "dispatch-validation-runs") {
      return {
        ...check,
        args: [
          "--base-url",
          baseUrl,
          "--mode",
          "full",
          "--requested-by",
          "post_deploy_validation",
        ],
      };
    }

    if (check.id === "execute-validation-dispatch") {
      return {
        ...check,
        args: [
          "--base-url",
          baseUrl,
          "--mode",
          "full",
          "--requested-by",
          "post_deploy_validation",
        ],
      };
    }

    return check;
  });

  if (hasArg("--dry-run")) {
    console.log("post-deploy-validation dry run");
    for (const check of checks) {
      const args = check.args?.join(" ") ?? "";
      console.log(`- ${check.id}: ${check.scriptPath}${args ? ` ${args}` : ""}`);
    }
    return;
  }

  const tsxBin = resolveTsxBin();
  const results: CheckResult[] = [];
  let dispatchBatchId: string | undefined;

  for (const check of checks) {
    let effectiveCheck = check;

    if (check.id === "execute-validation-dispatch" && dispatchBatchId) {
      effectiveCheck = {
        ...check,
        args: [
          "--base-url",
          baseUrl,
          "--mode",
          "full",
          "--requested-by",
          "post_deploy_validation",
          "--dispatch-batch-id",
          dispatchBatchId,
        ],
      };
    }

    if (check.id === "validation-verdict" && dispatchBatchId) {
      effectiveCheck = {
        ...check,
        args: [
          "--base-url",
          baseUrl,
          "--freshness-minutes",
          "30",
          "--dispatch-batch-id",
          dispatchBatchId,
        ],
      };
    }

    if (check.id === "validation-policy" && dispatchBatchId) {
      effectiveCheck = {
        ...check,
        args: [
          "--base-url",
          baseUrl,
          "--freshness-minutes",
          "30",
          "--dispatch-batch-id",
          dispatchBatchId,
        ],
      };
    }

    const result = runCheck(tsxBin, effectiveCheck);
    results.push(result);

    if (check.id === "dispatch-validation-runs" && result.dispatchBatchId) {
      dispatchBatchId = result.dispatchBatchId;
    }
  }

  const failed = results.filter((result) => result.status === "fail");

  console.log("\nPost-deploy validation summary");
  for (const result of results) {
    if (result.status === "skip") {
      console.warn(`- SKIP: ${result.check.label} (${result.skipReason})`);
      continue;
    }

    if (result.status === "warn") {
      console.warn(`- WARN: ${result.check.label} (${result.warnReason})`);
      continue;
    }

    const status = result.status === "pass" ? "PASS" : "FAIL";
    console.log(`- ${status}: ${result.check.label}`);
  }

  if (failed.length > 0) {
    process.exit(1);
  }
}

main();