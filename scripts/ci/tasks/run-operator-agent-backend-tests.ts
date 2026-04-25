/* eslint-disable no-console */

import { spawnSync } from "node:child_process";
import { optionalEnv } from "../shared/env";
import { runChecks, type CheckSpec } from "./run-checks";

function runNpmScript(script: string): void {
  console.log(`\n==> npm run ${script}`);

  const result = spawnSync("npm", ["run", script], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    encoding: "utf8",
  });

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    throw result.error;
  }
}

function hasLiveOperatorAgentEnv(): boolean {
  return Boolean(optionalEnv("OPERATOR_AGENT_BASE_URL"));
}

function hasOperatorAgentSchemaEnv(): boolean {
  return Boolean(
    optionalEnv("CLOUDFLARE_API_TOKEN") &&
      optionalEnv("CLOUDFLARE_ACCOUNT_ID") &&
      optionalEnv("WRANGLER_CONFIG_PATH"),
  );
}

function main(): void {
  runNpmScript("test:unit:operator-agent");
  runNpmScript("typecheck:operator-agent");

  const checks: CheckSpec[] = [];

  if (hasOperatorAgentSchemaEnv()) {
    checks.push({
      label: "operator-agent schema check",
      scriptPath: "scripts/ci/checks/schema/operator-agent-org-schema-check.ts",
    });
  } else {
    console.log(
      "\n==> skipping operator-agent schema check (missing Cloudflare D1 environment variables)",
    );
  }

  if (hasLiveOperatorAgentEnv()) {
    checks.push(
      {
        label: "operator surface check",
        scriptPath: "scripts/ci/checks/contracts/operator-surface-check.ts",
      },
      {
        label: "operator-agent contract check",
        scriptPath: "scripts/ci/checks/contracts/operator-agent-contract-check.ts",
      },
      {
        label: "task-type normalization contract check",
        scriptPath: "scripts/ci/checks/contracts/task-type-normalization-contract-check.ts",
      },
      {
        label: "task-payload normalization contract check",
        scriptPath: "scripts/ci/checks/contracts/task-payload-normalization-contract-check.ts",
      },
    );
  } else {
    console.log(
      "\n==> skipping live operator-agent route/contract checks (missing OPERATOR_AGENT_BASE_URL)",
    );
  }

  if (checks.length === 0) {
    console.log("\noperator-agent backend tests completed with typecheck only.");
    return;
  }

  runChecks(checks);
}

main();