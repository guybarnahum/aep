import { EmployeeControlStore } from "@aep/operator-agent/lib/employee-control-store";
import {
  mergeAuthority,
  mergeBudget,
} from "@aep/operator-agent/lib/policy-merge";
import { operatorEmployees } from "@aep/operator-agent/org/employees";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleEmployees(
  request: Request,
  env?: OperatorAgentEnv
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const store = new EmployeeControlStore(env ?? {});

  const employees = await Promise.all(
    operatorEmployees.map(async (employee) => {
      const control = await store.getEffective(
        employee.identity.employeeId,
        new Date().toISOString()
      );

      const effectiveAuthority = mergeAuthority(
        employee.authority,
        control.authorityOverride
      );

      const effectiveBudget = mergeBudget(
        employee.budget,
        control.budgetOverride
      );

      return {
        identity: employee.identity,
        authority: employee.authority,
        budget: employee.budget,
        effectiveAuthority,
        effectiveBudget,
        escalation: employee.escalation,
        effectiveState: {
          state: control.state,
          blocked: control.blocked,
        },
      };
    })
  );

  return Response.json({
    ok: true,
    count: employees.length,
    employees,
  });
}
