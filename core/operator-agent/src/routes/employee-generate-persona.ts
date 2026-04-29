import { generateEmployeePersona } from "@aep/operator-agent/lib/employee-persona-generator";
import {
  updateEmployeeProfile,
} from "@aep/operator-agent/persistence/d1/employee-lifecycle-store-d1";
import {
  upsertEmployeePromptProfile,
} from "@aep/operator-agent/persistence/d1/employee-prompt-profile-store-d1";
import { getRoleCatalogEntry } from "@aep/operator-agent/persistence/d1/role-catalog-store-d1";
import type {
  AgentRoleId,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

type GeneratePersonaRequest = {
  employeeName?: string;
  roleId?: AgentRoleId;
  description?: string;
  strengths?: string[];
  workingStyle?: string;
  appearancePrompt?: string;
  birthYear?: number;
};

type EmployeeCatalogPersonaLookup = {
  employee_name: string;
  role_id: AgentRoleId;
};

async function requireEmployeeIdentity(
  env: OperatorAgentEnv,
  employeeId: string,
): Promise<EmployeeCatalogPersonaLookup> {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }

  const row = await env.OPERATOR_AGENT_DB.prepare(
    `SELECT employee_name, role_id
     FROM employees_catalog
     WHERE id = ?
     LIMIT 1`,
  )
    .bind(employeeId)
    .first<EmployeeCatalogPersonaLookup>();

  if (!row) {
    throw new Error(`Employee not found: ${employeeId}`);
  }

  return row;
}

export async function handleGenerateEmployeePersona(
  request: Request,
  env: OperatorAgentEnv | undefined,
  employeeId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env) {
    return Response.json(
      { ok: false, error: "Missing operator-agent environment" },
      { status: 500 },
    );
  }

  let body: GeneratePersonaRequest;
  try {
    body = (await request.json()) as GeneratePersonaRequest;
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  if (!body.description?.trim()) {
    return Response.json(
      { ok: false, error: "description is required" },
      { status: 400 },
    );
  }

  try {
    const employee = await requireEmployeeIdentity(env, employeeId);
    const roleId = body.roleId ?? employee.role_id;
    const role = await getRoleCatalogEntry(env, roleId);

    if (!role) {
      throw new Error(`Role not found: ${roleId}`);
    }

    const generated = await generateEmployeePersona({
      employeeName: body.employeeName ?? employee.employee_name,
      role,
      description: body.description,
      strengths: body.strengths,
      workingStyle: body.workingStyle,
      appearancePrompt: body.appearancePrompt,
      birthYear: body.birthYear,
    }, env);

    await updateEmployeeProfile(env, employeeId, {
      employeeName: body.employeeName,
      bio: generated.publicProfile.bio,
      tone: generated.publicProfile.tone,
      skills: generated.publicProfile.skills,
      appearanceSummary: generated.publicProfile.appearanceSummary,
      birthYear: generated.publicProfile.birthYear,
    });

    await upsertEmployeePromptProfile(env, {
      employeeId,
      basePrompt: generated.privateProfile.basePrompt,
      decisionStyle: generated.privateProfile.decisionStyle,
      collaborationStyle: generated.privateProfile.collaborationStyle,
      identitySeed: generated.privateProfile.identitySeed,
      portraitPrompt: generated.privateProfile.portraitPrompt,
      promptVersion: "employee-persona-v1",
      status: "draft",
    });

    return Response.json({
      ok: true,
      employeeId,
      generated: {
        publicProfile: generated.publicProfile,
        promptProfileStatus: "draft",
        synthesisMode: generated.synthesisMode,
        model: generated.model,
      },
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate employee persona",
      },
      { status: 400 },
    );
  }
}