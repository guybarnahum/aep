/* eslint-disable no-console */

import { runChecks } from "../../tasks/run-checks";

runChecks([
  {
    label: "Operator-agent contract check",
    scriptPath: "scripts/ci/checks/contracts/operator-agent-contract-check.ts",
  },
  {
    label: "Operator-agent behavior check",
    scriptPath: "scripts/ci/checks/policy/operator-agent-behavior-check.ts",
  },
]);