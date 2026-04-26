/* eslint-disable no-console */

export function ciRunId(): string {
  return process.env.GITHUB_RUN_ID ?? process.env.CI_RUN_ID ?? "local";
}

export function ciArtifactMarker(checkName: string) {
  return {
    __ci: {
      runId: ciRunId(),
      checkName,
      workflow: process.env.GITHUB_WORKFLOW ?? "local",
      environment: process.env.ENVIRONMENT_NAME ?? process.env.CF_ENV ?? "unknown",
      createdAt: new Date().toISOString(),
    },
  };
}

export function ciActor(checkName: string): string {
  return `ci:${checkName}:${ciRunId()}`;
}
