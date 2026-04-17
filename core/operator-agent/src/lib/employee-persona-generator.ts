import type {
  OperatorAgentEnv,
  EmployeePersonaGenerationPublicResult,
  RoleJobDescriptionProjection,
} from "@aep/operator-agent/types";

export type PersonaGenerationInput = {
  employeeName: string;
  role: RoleJobDescriptionProjection;
  description: string;
  strengths?: string[];
  workingStyle?: string;
  appearancePrompt?: string;
  birthYear?: number;
};

export type PersonaGenerationOutput = {
  publicProfile: EmployeePersonaGenerationPublicResult;
  privateProfile: {
    basePrompt: string;
    decisionStyle?: string;
    collaborationStyle?: string;
    identitySeed?: string;
    portraitPrompt?: string;
  };
  synthesisMode: "ai" | "fallback";
  model?: string;
};

const DEFAULT_PERSONA_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }

  return out;
}

function summarizeDescription(description: string): string {
  return description.trim().replace(/\s+/g, " ");
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function isAiEnabled(env?: OperatorAgentEnv): boolean {
  return String(env?.AEP_AI_ENABLED ?? "false") === "true";
}

function getAiModel(env?: OperatorAgentEnv): string {
  return env?.AEP_AI_MODEL ?? DEFAULT_PERSONA_AI_MODEL;
}

function inferTone(role: RoleJobDescriptionProjection, workingStyle?: string): string {
  if (workingStyle?.trim()) {
    return workingStyle.trim();
  }

  if (role.seniorityLevel === "manager") {
    return "Structured, calm, and strategically communicative.";
  }

  return "Professional, clear, and execution-focused.";
}

function inferSkills(
  role: RoleJobDescriptionProjection,
  strengths?: string[],
): string[] {
  const responsibilitySkills = role.responsibilities
    .flatMap((item) => item.split(/[,/]/g))
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);

  return uniqueStrings([...(strengths ?? []), ...responsibilitySkills]).slice(0, 6);
}

function inferAppearanceSummary(
  role: RoleJobDescriptionProjection,
  appearancePrompt?: string,
): string | undefined {
  if (appearancePrompt?.trim()) {
    return appearancePrompt.trim();
  }

  return `${role.title} with a composed, professional, modern technical presence.`;
}

function buildIdentitySeed(input: PersonaGenerationInput): string {
  return [
    input.employeeName,
    input.role.roleId,
    input.role.teamId,
    input.description.trim(),
  ].join(" | ");
}

function fallbackPersonaGeneration(
  input: PersonaGenerationInput,
): PersonaGenerationOutput {
  const description = summarizeDescription(input.description);
  const tone = inferTone(input.role, input.workingStyle);
  const skills = inferSkills(input.role, input.strengths);
  const appearanceSummary = inferAppearanceSummary(input.role, input.appearancePrompt);

  const basePrompt = [
    `You are ${input.employeeName}, serving as ${input.role.title}.`,
    `Role contract: ${input.role.jobDescriptionText}`,
    `Core responsibilities: ${input.role.responsibilities.join("; ")}.`,
    `Success metrics: ${input.role.successMetrics.join("; ")}.`,
    `Constraints: ${input.role.constraints.join("; ")}.`,
    `Public professional profile: ${description}`,
    "Operate through canonical tasks, threads, artifacts, approvals, and escalations.",
    "Keep private cognition private and publish only bounded public rationale.",
  ].join(" ");

  const decisionStyle =
    input.role.seniorityLevel === "manager"
      ? "Structured, comparative, and governance-aware."
      : "Evidence-first, scoped, and execution-oriented.";

  const collaborationStyle =
    input.workingStyle?.trim()
      ? input.workingStyle.trim()
      : "Works clearly through canonical threads, explicit handoffs, and bounded rationale.";

  const portraitPrompt = appearanceSummary
    ? `${appearanceSummary} Professional portrait, neutral background, modern company aesthetic.`
    : undefined;

  return {
    publicProfile: {
      bio: description,
      tone,
      skills,
      appearanceSummary,
      birthYear: input.birthYear,
    },
    privateProfile: {
      basePrompt,
      decisionStyle,
      collaborationStyle,
      identitySeed: buildIdentitySeed(input),
      portraitPrompt,
    },
    synthesisMode: "fallback",
  };
}

function buildPersonaSystemPrompt(input: PersonaGenerationInput): string {
  return [
    "You are generating an employee persona for AEP.",
    "Return strict JSON only.",
    "Create two layers:",
    "- publicProfile: safe to expose in UI/API",
    "- privateProfile: private cognition scaffolding stored inside the employee boundary",
    "Do not include any fields outside the requested schema.",
    "Public profile must remain professional and outward-facing.",
    "Private profile should align with the role contract and employee description.",
    "Do not claim hidden memory, biography facts, or credentials not grounded in the input.",
    "Keep private cognition private and optimize for durable employee continuity.",
  ].join(" ");
}

function buildPersonaUserPrompt(input: PersonaGenerationInput): string {
  return [
    "[EMPLOYEE NAME]",
    input.employeeName,
    "",
    "[ROLE TITLE]",
    input.role.title,
    "",
    "[ROLE ID]",
    input.role.roleId,
    "",
    "[TEAM ID]",
    input.role.teamId,
    "",
    "[JOB DESCRIPTION]",
    input.role.jobDescriptionText,
    "",
    "[RESPONSIBILITIES]",
    input.role.responsibilities.join("; "),
    "",
    "[SUCCESS METRICS]",
    input.role.successMetrics.join("; "),
    "",
    "[CONSTRAINTS]",
    input.role.constraints.join("; "),
    "",
    "[EMPLOYEE DESCRIPTION]",
    summarizeDescription(input.description),
    "",
    "[STRENGTHS]",
    (input.strengths ?? []).join("; "),
    "",
    "[WORKING STYLE]",
    input.workingStyle ?? "",
    "",
    "[APPEARANCE PROMPT]",
    input.appearancePrompt ?? "",
    "",
    "[BIRTH YEAR]",
    typeof input.birthYear === "number" ? String(input.birthYear) : "",
    "",
    "[OUTPUT JSON SCHEMA]",
    JSON.stringify({
      publicProfile: {
        bio: "string",
        tone: "string",
        skills: ["string"],
        appearanceSummary: "string",
        birthYear: "number | omitted",
      },
      privateProfile: {
        basePrompt: "string",
        decisionStyle: "string",
        collaborationStyle: "string",
        identitySeed: "string",
        portraitPrompt: "string",
      },
    }),
  ].join("\n");
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((entry) => asNonEmptyString(entry))
    .filter((entry): entry is string => Boolean(entry));

  return normalized.length > 0 ? normalized : undefined;
}

export function parsePersonaGenerationResponse(raw: unknown): {
  publicProfile: EmployeePersonaGenerationPublicResult;
  privateProfile: PersonaGenerationOutput["privateProfile"];
} | null {
  let parsed: unknown = raw;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }

    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const publicProfile =
    record.publicProfile && typeof record.publicProfile === "object"
      ? (record.publicProfile as Record<string, unknown>)
      : null;
  const privateProfile =
    record.privateProfile && typeof record.privateProfile === "object"
      ? (record.privateProfile as Record<string, unknown>)
      : null;

  if (!publicProfile || !privateProfile) {
    return null;
  }

  const birthYear =
    typeof publicProfile.birthYear === "number"
      ? publicProfile.birthYear
      : typeof publicProfile.birthYear === "string" &&
          publicProfile.birthYear.trim().length > 0
        ? Number.parseInt(publicProfile.birthYear, 10)
        : undefined;

  const normalizedPublic: EmployeePersonaGenerationPublicResult = {
    bio: asNonEmptyString(publicProfile.bio),
    tone: asNonEmptyString(publicProfile.tone),
    skills: normalizeStringArray(publicProfile.skills),
    appearanceSummary: asNonEmptyString(publicProfile.appearanceSummary),
    birthYear: Number.isFinite(birthYear) ? birthYear : undefined,
  };

  const normalizedPrivate = {
    basePrompt: asNonEmptyString(privateProfile.basePrompt),
    decisionStyle: asNonEmptyString(privateProfile.decisionStyle),
    collaborationStyle: asNonEmptyString(privateProfile.collaborationStyle),
    identitySeed: asNonEmptyString(privateProfile.identitySeed),
    portraitPrompt: asNonEmptyString(privateProfile.portraitPrompt),
  };

  if (!normalizedPrivate.basePrompt || !normalizedPublic.bio) {
    return null;
  }

  return {
    publicProfile: normalizedPublic,
    privateProfile: {
      basePrompt: normalizedPrivate.basePrompt,
      decisionStyle: normalizedPrivate.decisionStyle,
      collaborationStyle: normalizedPrivate.collaborationStyle,
      identitySeed: normalizedPrivate.identitySeed,
      portraitPrompt: normalizedPrivate.portraitPrompt,
    },
  };
}

async function invokeModelPersonaGeneration(
  input: PersonaGenerationInput,
  env?: OperatorAgentEnv,
): Promise<PersonaGenerationOutput | null> {
  if (!env || !env.AI || !isAiEnabled(env)) {
    return null;
  }

  const model = getAiModel(env);

  try {
    const raw = await env.AI.run(model, {
      system: buildPersonaSystemPrompt(input),
      prompt: buildPersonaUserPrompt(input),
      max_tokens: 700,
    });

    const parsed = parsePersonaGenerationResponse(raw);
    if (!parsed) {
      return null;
    }

    const appearanceSummary =
      parsed.publicProfile.appearanceSummary ??
      inferAppearanceSummary(input.role, input.appearancePrompt);

    return {
      publicProfile: {
        bio: parsed.publicProfile.bio,
        tone: parsed.publicProfile.tone ?? inferTone(input.role, input.workingStyle),
        skills: parsed.publicProfile.skills ?? inferSkills(input.role, input.strengths),
        appearanceSummary,
        birthYear: parsed.publicProfile.birthYear ?? input.birthYear,
      },
      privateProfile: {
        basePrompt: parsed.privateProfile.basePrompt,
        decisionStyle: parsed.privateProfile.decisionStyle,
        collaborationStyle: parsed.privateProfile.collaborationStyle,
        identitySeed: parsed.privateProfile.identitySeed ?? buildIdentitySeed(input),
        portraitPrompt:
          parsed.privateProfile.portraitPrompt ??
          (appearanceSummary
            ? `${appearanceSummary} Professional portrait, neutral background, modern company aesthetic.`
            : undefined),
      },
      synthesisMode: "ai",
      model,
    };
  } catch {
    return null;
  }
}

export async function generateEmployeePersona(
  input: PersonaGenerationInput,
  env?: OperatorAgentEnv,
): Promise<PersonaGenerationOutput> {
  const aiResult = await invokeModelPersonaGeneration(input, env);
  if (aiResult) {
    return aiResult;
  }

  return fallbackPersonaGeneration(input);
}