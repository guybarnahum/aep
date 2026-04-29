/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  STAFFING_CONTRACTS,
  getStaffingContract,
} from "@aep/operator-agent/hr/staffing-contracts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const requiredContracts = [
  "job_description",
  "staffing_request",
  "hiring_recommendation",
  "role_gap",
] as const;

for (const kind of requiredContracts) {
  const contract = getStaffingContract(kind);
  assert(contract, `Missing staffing contract ${kind}`);
  assert(contract.sourceRequired === true, `${kind} must require source linkage`);
  assert(contract.ownershipRequired === true, `${kind} must require ownership`);
  assert(
    contract.approvalBoundary.directFulfillmentAllowed === false,
    `${kind} must deny direct fulfillment`,
  );
}

assert(
  getStaffingContract("staffing_request")?.lifecycleStates.join(" ") ===
    "draft submitted approved fulfilled rejected canceled",
  "StaffingRequest lifecycle must match staffing contract",
);

assert(
  getStaffingContract("role_gap")?.approvalBoundary.approvalSurface === "advisory_only",
  "RoleGap must remain advisory-only",
);

assert(
  (() => {
    const staffingRequest = getStaffingContract("staffing_request");
    if (!staffingRequest) return false;
    if (!("employeeCreationRoute" in staffingRequest.approvalBoundary)) return false;
    return staffingRequest.approvalBoundary.employeeCreationRoute === "POST /agent/employees";
  })(),
  "StaffingRequest fulfillment must use canonical employee creation route",
);

const contractKinds = new Set(STAFFING_CONTRACTS.map((contract) => contract.kind));
assert(contractKinds.size === STAFFING_CONTRACTS.length, "Staffing contracts must not duplicate kinds");

const contractSource = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/hr/staffing-contracts.ts"),
  "utf8",
);

assert(
  contractSource.includes("parallelHrDatabaseAllowed: false"),
  "Staffing contracts must deny a parallel HR database",
);

assert(
  contractSource.includes("directEmployeeMutationAllowed: false"),
  "Staffing contracts must deny direct employee mutation",
);

assert(
  contractSource.includes("POST /agent/employees"),
  "Staffing contracts must reference canonical employee creation route",
);

console.log("staffing-contract-check passed", {
  contractCount: STAFFING_CONTRACTS.length,
});
