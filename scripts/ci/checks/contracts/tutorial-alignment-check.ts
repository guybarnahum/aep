/* eslint-disable no-console */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

assert(existsSync(resolve(process.cwd(), "TUTORIAL.md")), "TUTORIAL.md must exist");

const tutorial = read("TUTORIAL.md");
const llm = read("LLM.md");
const api = read("API.md");

for (const required of [
  "not a pipeline",
  "loop",
  "Human Visibility",
  "intervene",
  "Jira",
  "GitHub repo",
  "deployment",
  "customer intake",
]) {
  assert(
    tutorial.toLowerCase().includes(required.toLowerCase()),
    `TUTORIAL.md must explain ${required}`,
  );
}

for (const required of [
  "product initiative definition",
  "deployable artifacts",
  "deployment system",
  "external-safe product surfaces",
  "customer intake flow",
  "agentic execution through task graphs",
  "human visibility and intervention",
  "enforcement and guardrails",
]) {
  assert(llm.includes(required), `LLM.md must include feature: ${required}`);
}

for (const route of [
  "/agent/customer-intake",
  "/agent/projects/:id/product-execution",
  "/agent/projects/:id/product-visibility",
  "/agent/projects/:id/interventions",
  "/agent/product-deployments",
]) {
  assert(api.includes(route), `API.md must document ${route}`);
}

for (const invariant of [
  "AEP remains the source of truth",
  "must not own canonical state",
  "private cognition",
  "does not create projects",
  "does not create tasks",
  "does not deploy",
]) {
  assert(
    tutorial.includes(invariant) || api.includes(invariant) || llm.includes(invariant),
    `Docs must preserve invariant: ${invariant}`,
  );
}

console.log("tutorial-alignment-check passed");