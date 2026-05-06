import assert from "node:assert/strict";
import test from "node:test";
import { fulfillStaffingRequest } from "./staffing-fulfillment";

function makeDb(args: {
  requestState?: string;
  runtimeEnabled?: number;
  implementationBinding?: string | null;
}) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  return {
    calls,
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          calls.push({ sql, values });
          return this;
        },
        async first() {
          if (sql.includes("FROM staffing_requests")) {
            return {
              id: "staffreq_1",
              company_id: "company_internal_aep",
              role_id: "product-manager-web",
              team_id: "team_web_product",
              reason: "Need PM",
              urgency: "high",
              source_kind: "project",
              source_id: "project_1",
              requested_by_employee_id: "operator:manual-qa",
              state: args.requestState ?? "approved",
              status: args.requestState ?? "approved",
              employee_spec: JSON.stringify({
                roleId: "product-manager-web",
                teamId: "team_web_product",
                runtimeStatus: "implemented",
                employmentStatus: "active",
                schedulerMode: "auto",
                implementationBindingRequired: "pm-agent",
                suggestedName: "Web Product Manager",
              }),
            };
          }
          if (sql.includes("FROM roles_catalog")) {
            return {
              role_id: "product-manager-web",
              title: "Web Product Manager",
              team_id: "team_web_product",
              employee_id_code: "pm",
              runtime_enabled: args.runtimeEnabled ?? 1,
              implementation_binding: args.implementationBinding ?? "pm-agent",
            };
          }
          if (sql.includes("SELECT employee_id_code")) {
            return { employee_id_code: "pm" };
          }
          if (sql.includes("FROM teams")) {
            return { id: "team_web_product" };
          }
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          return { success: true };
        },
      };
    },
  };
}

test("staffing fulfillment creates runtime-ready employee from employeeSpec", async () => {
  const db = makeDb({ runtimeEnabled: 1, implementationBinding: "pm-agent" });

  const result = await fulfillStaffingRequest(
    { OPERATOR_AGENT_DB: db as unknown as D1Database },
    "staffreq_1",
    {
      employeeName: "Web Product Manager",
      fulfilledByEmployeeId: "operator:manual-qa",
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.employmentStatus, "active");
  assert.ok(
    db.calls.some((call) =>
      call.sql.includes("INSERT INTO employees_catalog") &&
      call.values.includes("implemented") &&
      call.values.includes("active") &&
      call.values.includes("auto"),
    ),
  );
});

test("staffing fulfillment refuses when role runtime is disabled", async () => {
  await assert.rejects(
    () =>
      fulfillStaffingRequest(
        { OPERATOR_AGENT_DB: makeDb({ runtimeEnabled: 0 }) as unknown as D1Database },
        "staffreq_1",
        {
          employeeName: "Web Product Manager",
          fulfilledByEmployeeId: "operator:manual-qa",
        },
      ),
    /not runtime enabled/,
  );
});

test("staffing fulfillment refuses binding mismatch", async () => {
  await assert.rejects(
    () =>
      fulfillStaffingRequest(
        {
          OPERATOR_AGENT_DB: makeDb({
            runtimeEnabled: 1,
            implementationBinding: "different-agent",
          }) as unknown as D1Database,
        },
        "staffreq_1",
        {
          employeeName: "Web Product Manager",
          fulfilledByEmployeeId: "operator:manual-qa",
        },
      ),
    /does not match required binding/,
  );
});
