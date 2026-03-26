import { EmployeeControlStore } from "@aep/operator-agent/lib/employee-control-store";
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
      const control = await store.get(employee.identity.employeeId);

      return {
        identity: employee.identity,
        authority: employee.authority,
        budget: employee.budget,
        escalation: employee.escalation,
        effectiveState: {
          enabled: control ? control.enabled : true,
          control,
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
