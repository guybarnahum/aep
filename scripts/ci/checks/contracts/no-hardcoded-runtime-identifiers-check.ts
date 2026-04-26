/* eslint-disable no-console */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

type Finding = {
  file: string;
  line: number;
  pattern: string;
  text: string;
};

type Rule = {
  name: string;
  regex: RegExp;
};

const ALLOWED_PATH_PATTERNS = [
  /^infra\/cloudflare\/d1\/.*migrations\//,
  /^docs\//,
  /^README\.md$/,
  /^API\.md$/,
  /^LLM\.md$/,
  /^examples\//,
  /^scripts\/dev\//,
  /^scripts\/ci\/checks\/contracts\/no-hardcoded-runtime-identifiers-check\.ts$/,
  /^scripts\/ci\/checks\/contracts\/email-adapter-contract-check\.ts$/,
  /^scripts\/ci\/shared\/runtime-literal-allowlist\.ts$/,
  /\.test\.ts$/,
];

const RULES: Rule[] = [
  {
    name: "static employee id",
    regex: /\b(?:qa|pm|dv|op|mg)\d{3}\b/g,
  },
  {
    name: "placeholder recipient",
    regex: /\b[a-z0-9._%+-]+@example\.com\b/gi,
  },
  {
    name: "personal workers.dev url",
    regex: /https:\/\/[a-z0-9.-]*guybubba[a-z0-9.-]*\.workers\.dev\b/gi,
  },
  {
    name: "committed recurring validation url",
    regex: /\bRECURRING_VALIDATION_BASE_URL\b/g,
  },
  {
    name: "committed cleanup token",
    regex: /\bSYNTHETIC_EMPLOYEE_CLEANUP_TOKEN\b/g,
  },
  {
    name: "removed shared employee ids helper",
    regex: /shared\/employee-ids|employee-ids\.ts/g,
  },
  {
    name: "implicit internal org default",
    regex: /Unable to resolve default|default timeout-recovery-operator|default infra-ops-manager/g,
  },
];

function listTrackedFiles(): string[] {
  const output = execFileSync("git", ["ls-files"], {
    encoding: "utf8",
  });

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) =>
      /\.(ts|tsx|js|mjs|json|jsonc|md|yml|yaml|sh|toml)$/.test(file),
    );
}

function isAllowedPath(file: string): boolean {
  return ALLOWED_PATH_PATTERNS.some((pattern) => pattern.test(file));
}

function scanFile(file: string): Finding[] {
  if (isAllowedPath(file)) {
    return [];
  }

  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");
  const findings: Finding[] = [];

  for (const rule of RULES) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      rule.regex.lastIndex = 0;

      if (rule.regex.test(line)) {
        findings.push({
          file,
          line: index + 1,
          pattern: rule.name,
          text: line.trim(),
        });
      }
    }
  }

  return findings;
}

function main(): void {
  const findings = listTrackedFiles().flatMap(scanFile);

  if (findings.length > 0) {
    console.error("Hardcoded runtime identifier guardrail failed.");
    console.error("");
    console.error(
      "Active runtime/config/CI code must not reintroduce static employee ids, placeholder recipients, personal workers.dev URLs, cleanup tokens, or implicit internal-org defaults.",
    );
    console.error("");

    for (const finding of findings) {
      console.error(
        `${finding.file}:${finding.line} [${finding.pattern}] ${finding.text}`,
      );
    }

    process.exit(1);
  }

  console.log("no-hardcoded-runtime-identifiers-check passed");
}

main();