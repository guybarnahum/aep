/* eslint-disable no-console */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

type ValidationCheck = {
  id: string;
  label: string;
  scriptPath: string;
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

function runCheck(tsxBin: string, check: ValidationCheck): number {
  console.log(`\n==> ${check.label}`);
  console.log(`Running ${check.scriptPath}`);

  const result = spawnSync(tsxBin, [check.scriptPath], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  if (typeof result.status === "number") {
    return result.status;
  }

  if (result.error) {
    console.error(`Failed to launch ${check.scriptPath}`);
    console.error(result.error);
  }

  return 1;
}

function main(): void {
  if (hasArg("--dry-run")) {
    console.log("post-deploy-validation dry run");
    for (const check of CHECKS) {
      console.log(`- ${check.id}: ${check.scriptPath}`);
    }
    return;
  }

  const tsxBin = resolveTsxBin();
  const results = CHECKS.map((check) => ({
    check,
    exitCode: runCheck(tsxBin, check),
  }));

  const failed = results.filter((result) => result.exitCode !== 0);

  console.log("\nPost-deploy validation summary");
  for (const result of results) {
    const status = result.exitCode === 0 ? "PASS" : "FAIL";
    console.log(`- ${status}: ${result.check.label}`);
  }

  if (failed.length > 0) {
    process.exit(1);
  }
}

main();