/* eslint-disable no-console */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export type CheckSpec = {
  label: string;
  scriptPath: string;
};

function resolveTsxBin(): string {
  const localBin = resolve(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "tsx.cmd" : "tsx",
  );

  if (!existsSync(localBin)) {
    throw new Error(
      `Unable to find tsx executable at ${localBin}. Run npm ci before invoking CI scripts.`,
    );
  }

  return localBin;
}

export function runChecks(checks: CheckSpec[]): void {
  const tsxBin = resolveTsxBin();

  for (const check of checks) {
    console.log(`\n==> ${check.label}`);
    console.log(`Running ${check.scriptPath}`);

    const result = spawnSync(tsxBin, [check.scriptPath], {
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
}