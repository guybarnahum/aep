/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

async function purgeSyntheticEmployees(phase: "pre" | "post"): Promise<void> {
  const client = createOperatorAgentClient();

  let employeesResponse;
  try {
    employeesResponse = await client.listEmployees();
  } catch (err) {
    if (handleOperatorAgentSoftSkip("purge-synthetic-employees", err)) {
      process.exit(0);
    }
    throw err;
  }

  if (!employeesResponse.ok) {
    throw new Error("Failed to list employees for synthetic cleanup");
  }

  const syntheticEmployees = employeesResponse.employees.filter(
    (employee) => employee.employment?.isSynthetic === true,
  );

  if (syntheticEmployees.length === 0) {
    console.log(`purge-synthetic-employees: no synthetic employees found (${phase})`);
    return;
  }

  console.warn(
    `[purge-synthetic-employees] synthetic employees detected (${phase}): ${syntheticEmployees
      .map(
        (employee) =>
          `${employee.publicProfile?.displayName ?? employee.identity.employeeId} (${employee.identity.employeeId})`,
      )
      .join(", ")}`,
  );

  for (const employee of syntheticEmployees) {
    const employeeId = employee.identity.employeeId;
    const employmentStatus = employee.employment.employmentStatus;

    try {
      if (employmentStatus !== "archived") {
        if (employmentStatus !== "terminated" && employmentStatus !== "retired") {
          const terminateResult = await client.runEmployeeLifecycleAction(
            employeeId,
            "terminate",
            {
              reason: `Synthetic employee cleanup (${phase})`,
              approvedBy: "github-actions",
            },
          );

          if (!terminateResult.ok) {
            throw new Error(`terminate failed for ${employeeId}`);
          }
        }

        const archiveResult = await client.runEmployeeLifecycleAction(
          employeeId,
          "archive",
          {
            reason: `Synthetic employee cleanup (${phase})`,
            approvedBy: "github-actions",
          },
        );

        if (!archiveResult.ok) {
          throw new Error(`archive failed for ${employeeId}`);
        }
      }

      const purgeResult = await client.purgeSyntheticEmployee(employeeId);
      if (!purgeResult.ok || purgeResult.purged !== true) {
        throw new Error(`purge failed for ${employeeId}`);
      }

      console.log(`purge-synthetic-employees: purged ${employeeId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`purge-synthetic-employees: failed to purge ${employeeId}: ${message}`);
    }
  }
}

async function main(): Promise<void> {
  const phaseArg = process.argv[2];
  const phase: "pre" | "post" = phaseArg === "post" ? "post" : "pre";
  await purgeSyntheticEmployees(phase);
}

main().catch((error) => {
  console.error("purge-synthetic-employees failed");
  console.error(error);
  process.exit(1);
});