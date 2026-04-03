/* eslint-disable no-console */

import assert from "node:assert/strict";
import { fetchJson } from "../lib/http-json";

type JsonValue = unknown;

async function getJson(path: string): Promise<JsonValue> {
  const baseUrl = process.env.CONTROL_PLANE_BASE_URL;
  if (!baseUrl) {
    throw new Error("Missing CONTROL_PLANE_BASE_URL");
  }

  return fetchJson(baseUrl, path);
}

function expectIds(
  items: Array<Record<string, unknown>>,
  expectedIds: string[],
  label: string,
): void {
  const ids = new Set(items.map((item) => String(item.id ?? "")));
  for (const expectedId of expectedIds) {
    assert(ids.has(expectedId), `Missing ${label}: ${expectedId}`);
  }
}

async function main(): Promise<void> {
  const companies = (await getJson("/companies")) as {
    companies: Array<Record<string, unknown>>;
  };
  expectIds(companies.companies, ["company_internal_aep"], "company");

  const teams = (await getJson("/teams")) as {
    teams: Array<Record<string, unknown>>;
  };
  expectIds(
    teams.teams,
    ["team_infra", "team_web_product", "team_validation"],
    "team",
  );

  const tenants = (await getJson("/org/tenants")) as {
    tenants: Array<Record<string, unknown>>;
  };
  expectIds(
    tenants.tenants,
    ["tenant_internal_aep", "tenant_qa", "tenant_async_validation"],
    "org tenant",
  );

  const environments = (await getJson(
    "/org/tenants/tenant_internal_aep/environments",
  )) as {
    tenant_id: string;
    environments: Array<Record<string, unknown>>;
  };
  assert.equal(environments.tenant_id, "tenant_internal_aep");
  const envNames = new Set(
    environments.environments.map((env) => String(env.environment_name ?? "")),
  );
  for (const environmentName of ["preview", "staging", "production"]) {
    assert(envNames.has(environmentName), `Missing environment: ${environmentName}`);
  }

  const services = (await getJson("/services")) as {
    services: Array<Record<string, unknown>>;
  };
  expectIds(
    services.services,
    [
      "service_control_plane",
      "service_operator_agent",
      "service_dashboard",
      "service_ops_console",
    ],
    "service",
  );

  const employees = (await getJson("/employees")) as {
    employees: Array<Record<string, unknown>>;
  };
  expectIds(
    employees.employees,
    [
      "emp_timeout_recovery_01",
      "emp_retry_supervisor_01",
      "emp_infra_ops_manager_01",
      "emp_product_manager_web_01",
      "emp_frontend_engineer_01",
      "emp_validation_pm_01",
      "emp_validation_engineer_01",
    ],
    "employee",
  );

  const scope = (await getJson(
    "/employees/emp_product_manager_web_01/scope",
  )) as {
    employee_id: string;
    scope_bindings: Array<Record<string, unknown>>;
  };
  assert.equal(scope.employee_id, "emp_product_manager_web_01");
  assert(scope.scope_bindings.length >= 1, "Expected employee scope bindings");

  const hasDashboardPreview = scope.scope_bindings.some(
    (binding) =>
      binding.service_id === "service_dashboard" &&
      binding.environment_name === "preview",
  );
  assert(
    hasDashboardPreview,
    "Expected dashboard preview binding for emp_product_manager_web_01",
  );

  console.log("org-inventory-route-check passed", {
    companies: companies.companies.length,
    teams: teams.teams.length,
    tenants: tenants.tenants.length,
    services: services.services.length,
    employees: employees.employees.length,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});