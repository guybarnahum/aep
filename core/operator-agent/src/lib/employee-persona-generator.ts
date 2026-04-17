import type {
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
};

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

export function generateEmployeePersona(
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
  };
}