import { updateEmployeeProfile } from "@aep/operator-agent/lib/employee-lifecycle-store-d1";
import type {
  EmployeePublicLink,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

type UpdateEmployeeRequest = {
  employeeName?: string;
  schedulerMode?: string;
  bio?: string;
  tone?: string;
  skills?: string[];
  avatarUrl?: string;
  appearanceSummary?: string;
  birthYear?: number;
  publicLinks?: EmployeePublicLink[];
};

export async function handleUpdateEmployee(
  request: Request,
  env: OperatorAgentEnv | undefined,
  employeeId: string,
): Promise<Response> {
  if (request.method !== "PATCH") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json(
      { ok: false, error: "Missing operator-agent environment" },
      { status: 500 },
    );
  }

  let body: UpdateEmployeeRequest;
  try {
    body = (await request.json()) as UpdateEmployeeRequest;
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  try {
    await updateEmployeeProfile(env, employeeId, body);
    return Response.json({ ok: true, employeeId });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to update employee",
      },
      { status: 400 },
    );
  }
}