import { EmployeeControlStore } from "@aep/operator-agent/lib/employee-control-store";
import { operatorEmployees } from "@aep/operator-agent/org/employees";
import type { EmployeeControlRecord, OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleEmployeeControls(
  request: Request,
  env?: OperatorAgentEnv
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url = new URL(request.url);
  const employeeId = url.searchParams.get("employeeId");

  const store = new EmployeeControlStore(env ?? {});

  if (employeeId) {
    const record = await store.get(employeeId);
    return Response.json({
      ok: true,
      employeeId,
      control: record,
    });
  }

  const entries: Array<{
    employeeId: string;
    control: EmployeeControlRecord | null;
  }> = [];

  for (const employee of operatorEmployees) {
    const id = employee.identity.employeeId;
    entries.push({
      employeeId: id,
      control: await store.get(id),
    });
  }

  return Response.json({
    ok: true,
    count: entries.length,
    entries,
  });
}
