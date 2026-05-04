/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const main = readFileSync(
  resolve(process.cwd(), "apps/dashboard/src/main.ts"),
  "utf8",
);

assert(
  main.includes("promptForExistingEmployeeId"),
  "Dashboard must validate prompted employee IDs against employee registry",
);

assert(
  !main.includes('window.prompt("Requested by employee ID?")'),
  "Requested-by employee ID must not be unvalidated free text",
);

assert(
  !main.includes('window.prompt("Approved by employee ID?")'),
  "Approved-by employee ID must not be unvalidated free text",
);

assert(
  !main.includes('window.prompt("Fulfilled by employee ID?")'),
  "Fulfilled-by employee ID must not be unvalidated free text",
);

console.log("dashboard-employee-id-input-contract-check passed");
