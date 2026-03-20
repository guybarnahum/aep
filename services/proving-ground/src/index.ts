export interface CleanupAuditResult {
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; details?: string }>;
}

export async function runHealthCheck(previewUrl: string): Promise<void> {
  // Replace with real fetch(`${previewUrl}/health`) once the deployment adapter is wired.
  if (!previewUrl) {
    throw new Error("Missing preview URL");
  }
}

export async function runSmokeTest(previewUrl: string): Promise<void> {
  // Replace with real fetch(`${previewUrl}/hello`) once the deployment adapter is wired.
  if (!previewUrl) {
    throw new Error("Missing preview URL");
  }
}

export async function auditCleanup(statuses: {
  environmentStatus?: string;
  deploymentStatus?: string;
}): Promise<CleanupAuditResult> {
  const checks = [
    { name: "environment_destroyed", ok: statuses.environmentStatus === "destroyed" },
    { name: "deployment_destroyed", ok: statuses.deploymentStatus === "destroyed" },
  ];

  return {
    ok: checks.every((c) => c.ok),
    checks,
  };
}
