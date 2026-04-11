/* eslint-disable no-console */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  extractDispatchBatchId,
  extractSkipReason,
  extractWarnReason,
} from "./result-lines";

export type CheckStatus = "pass" | "fail" | "skip" | "warn";

export type RunScriptResult = {
  exitCode: number;
  status: CheckStatus;
  stdout: string;
  stderr: string;
  skipReason?: string;
  warnReason?: string;
  dispatchBatchId?: string;
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

export function runTsxScript(
  scriptPath: string,
  args: string[] = [],
): RunScriptResult {
  const tsxBin = resolveTsxBin();

  const result = spawnSync(tsxBin, [scriptPath, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
    encoding: "utf8",
  });

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const combined = `${stdout}\n${stderr}`;

  if (stdout.length > 0) {
    process.stdout.write(stdout);
  }
  if (stderr.length > 0) {
    process.stderr.write(stderr);
  }

  const exitCode = typeof result.status === "number" ? result.status : 1;
  const skipReason = extractSkipReason(combined);
  const warnReason = extractWarnReason(combined);
  const dispatchBatchId = extractDispatchBatchId(combined);

  if (exitCode === 0 && skipReason) {
    return {
      exitCode,
      status: "skip",
      stdout,
      stderr,
      skipReason,
      dispatchBatchId,
    };
  }

  if (exitCode === 0 && warnReason) {
    return {
      exitCode,
      status: "warn",
      stdout,
      stderr,
      warnReason,
      dispatchBatchId,
    };
  }

  return {
    exitCode,
    status: exitCode === 0 ? "pass" : "fail",
    stdout,
    stderr,
    dispatchBatchId,
  };
}