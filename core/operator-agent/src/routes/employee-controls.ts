import { createStores } from "@aep/operator-agent/lib/store-factory";
import { listEmployeeCatalog } from "@aep/operator-agent/persistence/d1/employee-catalog-store-d1";
import type { EmployeeControlRecord, OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleEmployeeControls(
  request: Request,
  env?: OperatorAgentEnv
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json(
      {
        ok: false,
        error: "Missing operator-agent environment",
      },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const employeeId = url.searchParams.get("employeeId");

  const stores = createStores(env);
  const store = stores.employeeControls;

  if (employeeId) {
    const record = await store.get(employeeId);
    const effective = await store.getEffective(employeeId, new Date().toISOString());
    return Response.json({
      ok: true,
      employeeId,
      control: record,
      effectiveState: {
        state: effective.state,
        blocked: effective.blocked,
      },
    });
  }

  const entries: Array<{
    employeeId: string;
    control: EmployeeControlRecord | null;
    effectiveState: {
      state: "enabled" | "disabled_pending_review" | "disabled_by_manager" | "restricted";
      blocked: boolean;
    };
  }> = [];
  const catalogEntries = await listEmployeeCatalog(env);

  for (const employee of catalogEntries) {
    const id = employee.employeeId;
    const effective = await store.getEffective(id, new Date().toISOString());
    entries.push({
      employeeId: id,
      control: await store.get(id),
      effectiveState: {
        state: effective.state,
        blocked: effective.blocked,
      },
    });
  }

  return Response.json({
    ok: true,
    count: entries.length,
    entries,
  });
}
