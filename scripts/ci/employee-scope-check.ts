/* eslint-disable no-console */

import assert from "node:assert/strict";
import { fetchJson } from "../lib/http-json";

async function main(): Promise<void> {
  const baseUrl = process.env.OPERATOR_AGENT_BASE_URL;
  if (!baseUrl) {
    throw new Error("Missing OPERATOR_AGENT_BASE_URL");
  }

  const timeoutScope = (await fetchJson(
    baseUrl,
    "/agent/employees/emp_timeout_recovery_01/scope",
  )) as {
    companyId: string;
    teamId: string;
    allowedTenants: string[];
    allowedServices: string[];
  };

  assert.equal(timeoutScope.companyId, "company_internal_aep");
  assert.equal(timeoutScope.teamId, "team_infra");
  assert(timeoutScope.allowedTenants.includes("tenant_internal_aep"));
  assert(timeoutScope.allowedServices.includes("service_control_plane"));

  const webScope = (await fetchJson(
    baseUrl,
    "/agent/employees/emp_product_manager_web_01/scope",
  )) as {
    teamId: string;
    allowedServices: string[];
    allowedEnvironmentNames: string[];
  };

  assert.equal(webScope.teamId, "team_web_product");
  assert(webScope.allowedServices.includes("service_dashboard"));
  assert(webScope.allowedEnvironmentNames.includes("preview"));

  const validationScope = (await fetchJson(
    baseUrl,
    "/agent/employees/emp_validation_engineer_01/scope",
  )) as {
    teamId: string;
    allowedEnvironmentNames: string[];
  };

  assert.equal(validationScope.teamId, "team_validation");
  assert(validationScope.allowedEnvironmentNames.includes("async_validation"));

  const effectivePolicy = (await fetchJson(
    baseUrl,
    "/agent/employees/emp_timeout_recovery_01/effective-policy",
  )) as {
    implemented: boolean;
    companyId: string;
    teamId: string;
    effectiveAuthority: {
      allowedTenants?: string[];
      allowedServices?: string[];
      allowedEnvironmentNames?: string[];
    };
  };

  assert.equal(effectivePolicy.implemented, true);
  assert.equal(effectivePolicy.companyId, "company_internal_aep");
  assert.equal(effectivePolicy.teamId, "team_infra");
  assert(
    effectivePolicy.effectiveAuthority.allowedServices?.includes(
      "service_control_plane",
    ),
  );

  const plannedPolicy = (await fetchJson(
    baseUrl,
    "/agent/employees/emp_product_manager_web_01/effective-policy",
  )) as {
    implemented: boolean;
    companyId: string;
    teamId: string;
    status: string;
  };

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