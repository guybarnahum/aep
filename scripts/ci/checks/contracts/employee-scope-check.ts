/* eslint-disable no-console */

import { assert } from "../../shared/assert";
import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import {
  EMPLOYEE_PRODUCT_MANAGER_WEB_ID,
  EMPLOYEE_RELIABILITY_ENGINEER_ID,
  EMPLOYEE_TIMEOUT_RECOVERY_ID,
  EMPLOYEE_VALIDATION_ENGINEER_ID,
} from "../../shared/employee-ids";

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  // ---- timeout recovery employee scope

  const timeoutScope = await client.getEmployeeScope(
    EMPLOYEE_TIMEOUT_RECOVERY_ID,
  );

  assert.equal(timeoutScope.companyId, "company_internal_aep");
  assert.equal(timeoutScope.teamId, "team_infra");

  assert(timeoutScope.allowedTenants.includes("tenant_internal_aep"));
  assert(timeoutScope.allowedServices.includes("service_control_plane"));

  // ---- web product manager scope

  const webScope = await client.getEmployeeScope(
    EMPLOYEE_PRODUCT_MANAGER_WEB_ID,
  );

  assert.equal(webScope.teamId, "team_web_product");

  assert(webScope.allowedServices.includes("service_dashboard"));
  assert(webScope.allowedEnvironmentNames.includes("preview"));

  // ---- validation engineer scope

  const validationScope = await client.getEmployeeScope(
    EMPLOYEE_VALIDATION_ENGINEER_ID,
  );

  assert.equal(validationScope.teamId, "team_validation");
  assert(
    validationScope.allowedEnvironmentNames.includes("async_validation"),
  );

  // ---- validation specialist scope (cross-tenant coverage)

  const validationSpecialistScope = await client.getEmployeeScope(
    EMPLOYEE_RELIABILITY_ENGINEER_ID,
  );

  assert.equal(validationSpecialistScope.companyId, "company_internal_aep");
  assert.equal(validationSpecialistScope.teamId, "team_validation");

  assert(
    validationSpecialistScope.allowedTenants.includes("tenant_internal_aep"),
  );
  assert(validationSpecialistScope.allowedTenants.includes("tenant_qa"));

  assert(
    validationSpecialistScope.allowedServices.includes(
      "service_control_plane",
    ),
  );

  // ---- effective policy (implemented employee)

  const effectivePolicy = await client.getEmployeeEffectivePolicy(
    EMPLOYEE_TIMEOUT_RECOVERY_ID,
  );

  assert.equal(effectivePolicy.implemented, true);
  assert.equal(effectivePolicy.companyId, "company_internal_aep");
  assert.equal(effectivePolicy.teamId, "team_infra");

  assert(
    effectivePolicy.effectiveAuthority?.allowedServices?.includes(
      "service_control_plane",
    ),
  );

  // ---- effective policy (planned employee)

  const plannedPolicy = await client.getEmployeeEffectivePolicy(
    EMPLOYEE_PRODUCT_MANAGER_WEB_ID,
  );

  assert.equal(plannedPolicy.implemented, false);
  assert.equal(plannedPolicy.companyId, "company_internal_aep");
  assert.equal(plannedPolicy.teamId, "team_web_product");
  assert.equal(plannedPolicy.status, "planned");

  console.log("employee-scope-check passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});