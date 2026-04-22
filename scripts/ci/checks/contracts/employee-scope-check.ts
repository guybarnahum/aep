/* eslint-disable no-console */

import { assert } from "../../shared/assert";
import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { resolveEmployeeIdByRole } from "../../lib/employee-resolution";

async function main(): Promise<void> {
  const client = createOperatorAgentClient();
  const agentBaseUrl = client.baseUrl;
  const timeoutRecoveryEmployeeId = await resolveEmployeeIdByRole({
    agentBaseUrl,
    roleId: "timeout-recovery-operator",
    teamId: "team_infra",
    runtimeStatus: "implemented",
  });
  const webProductManagerEmployeeId = await resolveEmployeeIdByRole({
    agentBaseUrl,
    roleId: "product-manager-web",
    teamId: "team_web_product",
  });
  const validationEngineerEmployeeId = await resolveEmployeeIdByRole({
    agentBaseUrl,
    roleId: "validation-engineer",
    teamId: "team_validation",
  });
  const reliabilityEngineerEmployeeId = await resolveEmployeeIdByRole({
    agentBaseUrl,
    roleId: "reliability-engineer",
    teamId: "team_validation",
    runtimeStatus: "implemented",
  });

  // ---- timeout recovery employee scope

  const timeoutScope = await client.getEmployeeScope(
    timeoutRecoveryEmployeeId,
  );

  assert.equal(timeoutScope.companyId, "company_internal_aep");
  assert.equal(timeoutScope.teamId, "team_infra");

  assert(timeoutScope.allowedTenants.includes("tenant_internal_aep"));
  assert(timeoutScope.allowedServices.includes("service_control_plane"));

  // ---- web product manager scope

  const webScope = await client.getEmployeeScope(
    webProductManagerEmployeeId,
  );

  assert.equal(webScope.teamId, "team_web_product");

  assert(webScope.allowedServices.includes("service_dashboard"));
  assert(webScope.allowedEnvironmentNames.includes("preview"));

  // ---- validation engineer scope

  const validationScope = await client.getEmployeeScope(
    validationEngineerEmployeeId,
  );

  assert.equal(validationScope.teamId, "team_validation");
  assert(
    validationScope.allowedEnvironmentNames.includes("async_validation"),
  );

  // ---- validation specialist scope (cross-tenant coverage)

  const validationSpecialistScope = await client.getEmployeeScope(
    reliabilityEngineerEmployeeId,
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
    timeoutRecoveryEmployeeId,
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
    webProductManagerEmployeeId,
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