import assert from "node:assert/strict";
import test from "node:test";
import {
  generateEmployeePersona,
  parsePersonaGenerationResponse,
  type PersonaGenerationInput,
} from "./employee-persona-generator";
import type { OperatorAgentEnv, RoleJobDescriptionProjection } from "../types";

const role: RoleJobDescriptionProjection = {
  roleId: "validation-engineer",
  title: "Validation Engineer",
  teamId: "team_validation",
  jobDescriptionText: "Owns validation planning and evidence quality for operator workflows.",
  responsibilities: ["Validation planning", "Evidence review", "Structured debugging"],
  successMetrics: ["High-signal bug reports", "Reliable validation outcomes"],
  constraints: ["Stay within approved validation scope"],
  seniorityLevel: "individual_contributor",
};

const input: PersonaGenerationInput = {
  employeeName: "Casey Validation",
  role,
  description: "Methodical validation engineer who documents evidence clearly.",
  strengths: ["Validation planning", "Evidence quality"],
  workingStyle: "Structured and explicit in handoffs.",
  appearancePrompt: "Calm technical professional with a precise presence.",
  birthYear: 1992,
};

test("parsePersonaGenerationResponse normalizes valid JSON string output", () => {
  const parsed = parsePersonaGenerationResponse(
    JSON.stringify({
      publicProfile: {
        bio: "  Analytical validation engineer.  ",
        tone: "  Calm and explicit.  ",
        skills: [" Evidence review ", "", "Structured debugging"],
        appearanceSummary: "  Precise technical presence. ",
        birthYear: "1992",
      },
      privateProfile: {
        basePrompt: "  You are Casey Validation.  ",
        decisionStyle: "  Evidence-first.  ",
        collaborationStyle: "  Clear handoffs.  ",
        identitySeed: "  Casey|validation  ",
        portraitPrompt: "  Professional portrait.  ",
      },
    }),
  );

  assert.deepEqual(parsed, {
    publicProfile: {
      bio: "Analytical validation engineer.",
      tone: "Calm and explicit.",
      skills: ["Evidence review", "Structured debugging"],
      appearanceSummary: "Precise technical presence.",
      birthYear: 1992,
    },
    privateProfile: {
      basePrompt: "You are Casey Validation.",
      decisionStyle: "Evidence-first.",
      collaborationStyle: "Clear handoffs.",
      identitySeed: "Casey|validation",
      portraitPrompt: "Professional portrait.",
    },
  });
});

test("parsePersonaGenerationResponse returns null for invalid payloads", () => {
  assert.equal(parsePersonaGenerationResponse("not json"), null);
  assert.equal(
    parsePersonaGenerationResponse({
      publicProfile: { bio: "Only public profile" },
    }),
    null,
  );
});

test("generateEmployeePersona falls back when AI output is unusable", async () => {
  const env: OperatorAgentEnv = {
    AEP_AI_ENABLED: "true",
    AI: {
      async run(): Promise<unknown> {
        return "not json";
      },
    },
  };

  const generated = await generateEmployeePersona(input, env);

  assert.equal(generated.synthesisMode, "fallback");
  assert.equal(generated.model, undefined);
  assert.equal(
    generated.publicProfile.bio,
    "Methodical validation engineer who documents evidence clearly.",
  );
  assert.equal(generated.publicProfile.birthYear, 1992);
  assert.match(generated.privateProfile.basePrompt, /Casey Validation/);
});