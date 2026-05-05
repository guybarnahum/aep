const { spawnSync } = require("node:child_process");
const {
  existsSync,
  readdirSync,
  readFileSync,
} = require("node:fs");
const { join, resolve } = require("node:path");

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const TSX_CLI_PATH = join(REPO_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const TSX_TSCONFIG_PATH = join(REPO_ROOT, "core", "control-plane", "tsconfig.json");
const TEST_FILES = [
  "core/control-plane/src/routes/validation-smoke.test.ts",
  "core/operator-agent/src/lib/employee-persona-generator.test.ts",
  "core/operator-agent/src/auth/cloudflare-access.test.ts",
  "core/operator-agent/src/auth/operator-identity.test.ts",
  "core/operator-agent/src/hr/staffing-request-spec.test.ts",
  "core/operator-agent/src/lib/implementation-binding-registry.test.ts",
  "core/operator-agent/src/lib/employee-cognition.test.ts",
  "core/operator-agent/src/persistence/d1/runtime-employee-resolver-d1.test.ts",
  "core/operator-agent/src/product/product-visibility-error-message.test.ts",
  "core/operator-agent/src/product/product-lifecycle-approval-visibility.test.ts",
];

function parseMajorVersion(version) {
  const match = /^v?(\d+)/.exec(version.trim());
  return match ? Number.parseInt(match[1], 10) : null;
}

function getNodeMajorVersion(nodePath) {
  const result = spawnSync(nodePath, ["-p", "process.versions.node"], {
    encoding: "utf8",
  });

  if (result.error || result.status !== 0 || !result.stdout) {
    return null;
  }

  return parseMajorVersion(result.stdout);
}

function listNvmNodeCandidates() {
  const homeDir = process.env.HOME;
  if (!homeDir) {
    return [];
  }

  const candidates = [];
  const nvmBin = process.env.NVM_BIN;
  if (nvmBin) {
    candidates.push(join(nvmBin, "node"));
  }

  const aliasDefaultPath = join(homeDir, ".nvm", "alias", "default");
  if (existsSync(aliasDefaultPath)) {
    const defaultAlias = readFileSync(aliasDefaultPath, "utf8").trim();
    if (/^v\d+/.test(defaultAlias)) {
      candidates.push(
        join(homeDir, ".nvm", "versions", "node", defaultAlias, "bin", "node"),
      );
    }
  }

  const versionsDir = join(homeDir, ".nvm", "versions", "node");
  if (!existsSync(versionsDir)) {
    return candidates;
  }

  const versionDirs = readdirSync(versionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^v\d+/.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => {
      const leftParts = left.replace(/^v/, "").split(".").map(Number);
      const rightParts = right.replace(/^v/, "").split(".").map(Number);
      const length = Math.max(leftParts.length, rightParts.length);

      for (let index = 0; index < length; index += 1) {
        const leftValue = leftParts[index] ?? 0;
        const rightValue = rightParts[index] ?? 0;
        if (leftValue !== rightValue) {
          return rightValue - leftValue;
        }
      }

      return 0;
    });

  for (const versionDir of versionDirs) {
    candidates.push(join(versionsDir, versionDir, "bin", "node"));
  }

  return candidates;
}

function resolvePreferredNode() {
  const seen = new Set();
  const candidates = [process.execPath, ...listNvmNodeCandidates(), "node"];

  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);

    const majorVersion = getNodeMajorVersion(candidate);
    if (majorVersion !== null && majorVersion >= 18) {
      return candidate;
    }
  }

  throw new Error(
    "Unable to find a Node.js executable with built-in test runner support (requires Node 18+).",
  );
}

function main() {
  if (!existsSync(TSX_CLI_PATH)) {
    throw new Error(
      `Unable to find tsx CLI at ${TSX_CLI_PATH}. Run npm ci before invoking tests.`,
    );
  }

  const nodePath = resolvePreferredNode();
  const result = spawnSync(nodePath, [TSX_CLI_PATH, "--test", ...TEST_FILES], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      TSX_TSCONFIG_PATH,
    },
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
}

main();