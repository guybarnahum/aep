import { executeEmployeeRun } from "@aep/operator-agent/lib/execute-employee-run";

async function main() {
  // Simulate a Marcus (PM) run
  const response = await executeEmployeeRun({
    employeeId: "emp_pm_01",
    roleId: "product-manager",
    companyId: "company_internal_aep",
    teamId: "team_infra",
    trigger: "manual",
    policyVersion: "pr5.3-test"
  });

  console.log("Marcus run response:", JSON.stringify(response, null, 2));

  // Optionally, verify the task was created in the ledger
  // (Assumes access to D1 or a mock store)
}

main().catch((err) => {
  console.error("Strategic Dispatch Test failed:", err);
  process.exit(1);
});
