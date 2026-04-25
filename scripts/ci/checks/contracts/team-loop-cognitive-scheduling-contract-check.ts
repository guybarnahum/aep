/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const sourcePath = resolve(
  process.cwd(),
  "core/operator-agent/src/lib/team-work-loop.ts",
);
const source = readFileSync(sourcePath, "utf8");

assert(
  source.includes("thinkWithinEmployeeBoundary("),
  "Expected selectTaskWithCognition to invoke bounded cognition",
);
assert(
  source.includes("derivePublicRationale(cognition)"),
  "Expected selectTaskWithCognition to derive public rationale from cognition output",
);
assert(
  !source.includes("Selected by deterministic fallback because cognitive scheduling was unavailable."),
  "Legacy deterministic-only fallback rationale is still present",
);

console.log("team-loop-cognitive-scheduling-contract-check passed", {
  sourcePath,
});
