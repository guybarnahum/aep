/* eslint-disable no-console */

import { buildDispatchArgs, buildVerdictArgs } from "../../tasks/validation-dispatch";
import { runTsxScript } from "../../tasks/run-observe";

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

function requireBaseUrl(): string {
  const baseUrl = process.env.CONTROL_PLANE_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      "CONTROL_PLANE_BASE_URL is required for post-deploy validation checks that call the deployed control-plane.",
    );
  }

  return baseUrl;
}

function main(): void {
  const baseUrl = requireBaseUrl();

  const checks = CHECKS.map((check) => {
    if (check.id === "validation-verdict") {
      return {
        ...check,
        args: buildVerdictArgs({
          baseUrl,
          freshnessMinutes: "30",
        }),
      };
    }

    if (check.id === "validation-policy") {
      return {
        ...check,
        args: buildVerdictArgs({
          baseUrl,
          freshnessMinutes: "30",
        }),
      };
    }

    if (check.id === "dispatch-validation-runs") {
      return {
        ...check,
        args: buildDispatchArgs({
          baseUrl,
          mode: "full",
          requestedBy: "post_deploy_validation",
        }),
      };
    }

    if (check.id === "execute-validation-dispatch") {
      return {
        ...check,
        args: buildDispatchArgs({
          baseUrl,
          mode: "full",
          requestedBy: "post_deploy_validation",
        }),
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

  const results: CheckResult[] = [];
  let dispatchBatchId: string | undefined;

  for (const check of checks) {
    let effectiveCheck = check;

    if (check.id === "execute-validation-dispatch" && dispatchBatchId) {
      effectiveCheck = {
        ...check,
        args: buildDispatchArgs({
          baseUrl,
          mode: "full",
          requestedBy: "post_deploy_validation",
          dispatchBatchId,
        }),
      };
    }

    if (check.id === "validation-verdict" && dispatchBatchId) {
      effectiveCheck = {
        ...check,
        args: buildVerdictArgs({
          baseUrl,
          freshnessMinutes: "30",
          dispatchBatchId,
        }),
      };
    }

    if (check.id === "validation-policy" && dispatchBatchId) {
      effectiveCheck = {
        ...check,
        args: buildVerdictArgs({
          baseUrl,
          freshnessMinutes: "30",
          dispatchBatchId,
        }),
      };
    }

    const observed = runTsxScript(
      effectiveCheck.scriptPath,
      effectiveCheck.args ?? [],
    );

    const result: CheckResult = {
      check: effectiveCheck,
      exitCode: observed.exitCode,
      status: observed.status,
      skipReason: observed.skipReason,
      warnReason: observed.warnReason,
      dispatchBatchId: observed.dispatchBatchId,
    };

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