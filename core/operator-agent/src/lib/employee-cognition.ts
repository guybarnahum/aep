import { getEmployeePromptProfile } from "@aep/operator-agent/lib/employee-prompt-profile-store-d1";
import type {
  AgentEmployeeDefinition,
  EmployeePromptProfile,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

type TaskLike = {
  id: string;
  taskType: string;
  title: string;
  payload: Record<string, unknown>;
};

type GenerateEmployeeInternalMonologueArgs = {
  env: OperatorAgentEnv;
  employee: AgentEmployeeDefinition;
  task: TaskLike;
  observation: string;
};

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function formatSkills(skills?: string[]): string {
  return Array.isArray(skills) && skills.length > 0
    ? skills.join(", ")
    : "generalist operational reasoning";
}

function isAiEnabled(env: OperatorAgentEnv): boolean {
  return String(env.AEP_AI_ENABLED ?? "false") === "true";
}

function getAiModel(env: OperatorAgentEnv): string {
  return env.AEP_AI_MODEL ?? "@cf/meta/llama-3.1-8b-instruct";
}

function extractAiText(result: unknown): string | null {
  if (typeof result === "string" && result.trim().length > 0) {
    return result.trim();
  }

  if (!result || typeof result !== "object") {
    return null;
  }

  const record = result as Record<string, unknown>;
  const directResponse = asNonEmptyString(record.response);
  if (directResponse) {
    return directResponse;
  }

  const directText = asNonEmptyString(record.text);
  if (directText) {
    return directText;
  }

  if (record.result && typeof record.result === "object") {
    const nested = record.result as Record<string, unknown>;
    return asNonEmptyString(nested.response) ?? asNonEmptyString(nested.text) ?? null;
  }

  return null;
}

async function loadPromptProfile(
  env: OperatorAgentEnv,
  employeeId: string,
): Promise<EmployeePromptProfile | null> {
  try {
    return await getEmployeePromptProfile(env, employeeId);
  } catch {
    return null;
  }
}

function buildCognitivePrompt(args: {
  employee: AgentEmployeeDefinition;
  task: TaskLike;
  observation: string;
  promptProfile: EmployeePromptProfile | null;
}): string {
  const displayName =
    args.employee.identity.employeeName ?? args.employee.identity.employeeId;
  const promptProfile = args.promptProfile;
  const decisionStyle =
    promptProfile?.decisionStyle ?? args.employee.identity.tone ?? "precise";
  const collaborationStyle = promptProfile?.collaborationStyle ?? "direct";
  const identitySeed =
    promptProfile?.identitySeed
    ?? args.employee.identity.bio
    ?? `${displayName} is accountable for disciplined execution inside AEP.`;
  const skills = formatSkills(args.employee.identity.skills);
  const targetUrl = asNonEmptyString(args.task.payload.targetUrl) ?? "unknown target";

  return [
    "[PRIVATE EMPLOYEE COGNITION]",
    `Employee: ${displayName}`,
    `Employee ID: ${args.employee.identity.employeeId}`,
    `Role: ${args.employee.identity.roleId}`,
    `Decision style: ${decisionStyle}`,
    `Collaboration style: ${collaborationStyle}`,
    `Skills: ${skills}`,
    `Identity seed: ${identitySeed}`,
    `Prompt version: ${promptProfile?.promptVersion ?? "fallback-v1"}`,
    promptProfile?.basePrompt
      ? `Base prompt: ${promptProfile.basePrompt}`
      : "Base prompt: Use disciplined, task-aware reasoning even when no stored prompt profile exists.",
    "",
    "[TASK CONTEXT]",
    `Task ID: ${args.task.id}`,
    `Task type: ${args.task.taskType}`,
    `Task title: ${args.task.title}`,
    `Target URL: ${targetUrl}`,
    `Observation: ${args.observation}`,
    "",
    "[INSTRUCTION]",
    "Produce a private 1-2 sentence internal monologue.",
    "Stay concrete, operational, and specific to the observation.",
    "Do not include markdown, bullet points, or policy disclaimers.",
  ].join("\n");
}

function buildFallbackMonologue(args: {
  employee: AgentEmployeeDefinition;
  observation: string;
  promptProfile: EmployeePromptProfile | null;
}): string {
  const displayName =
    args.employee.identity.employeeName ?? args.employee.identity.employeeId;
  const decisionStyle =
    args.promptProfile?.decisionStyle ?? args.employee.identity.tone ?? "precise";
  return `${displayName} interprets the signal as ${args.observation} The next decision should stay ${decisionStyle} and grounded in platform safety.`;
}

export async function generateEmployeeInternalMonologue(
  args: GenerateEmployeeInternalMonologueArgs,
): Promise<string> {
  const promptProfile = await loadPromptProfile(
    args.env,
    args.employee.identity.employeeId,
  );
  const prompt = buildCognitivePrompt({
    employee: args.employee,
    task: args.task,
    observation: args.observation,
    promptProfile,
  });

  if (isAiEnabled(args.env) && args.env.AI) {
    try {
      const result = await args.env.AI.run(getAiModel(args.env), {
        prompt,
        max_tokens: 120,
      });
      const text = extractAiText(result);
      if (text) {
        return text;
      }
    } catch {
      // Fall back to deterministic cognition when AI is unavailable.
    }
  }

  return buildFallbackMonologue({
    employee: args.employee,
    observation: args.observation,
    promptProfile,
  });
}