import assert from "node:assert/strict";
import test from "node:test";
import { validateStaffingEmployeeSpec } from "./staffing-request-spec";

test("staffing employee spec accepts matching runtime employee spec", () => {
  const result = validateStaffingEmployeeSpec(
    {
      roleId: "product-manager-web",
      teamId: "team_web_product",
      runtimeStatus: "implemented",
      employmentStatus: "active",
      schedulerMode: "auto",
      implementationBindingRequired: "pm-agent",
      suggestedName: "Web Product Manager",
    },
    { roleId: "product-manager-web", teamId: "team_web_product" },
  );

  assert.deepEqual(result, { ok: true });
});

test("staffing employee spec rejects role mismatch", () => {
  const result = validateStaffingEmployeeSpec(
    {
      roleId: "frontend-engineer",
      teamId: "team_web_product",
      runtimeStatus: "implemented",
      employmentStatus: "active",
      schedulerMode: "auto",
    },
    { roleId: "product-manager-web", teamId: "team_web_product" },
  );

  assert.equal(result.ok, false);
});

test("staffing employee spec rejects invalid runtime status", () => {
  const result = validateStaffingEmployeeSpec(
    {
      roleId: "product-manager-web",
      teamId: "team_web_product",
      runtimeStatus: "running",
      employmentStatus: "active",
      schedulerMode: "auto",
    },
    { roleId: "product-manager-web", teamId: "team_web_product" },
  );

  assert.equal(result.ok, false);
});
