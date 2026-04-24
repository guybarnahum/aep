/* eslint-disable no-console */

import { resolveEmployeeIdsByKey } from "../lib/employee-resolution";
import { hasDeliveredMirrorOutcome } from "./operator-agent-check-helpers";

export type AdapterCapabilities = {
  slackConfigured: boolean;
  emailConfigured: boolean;
};

export async function detectAdapterCapabilities(baseUrl: string): Promise<AdapterCapabilities> {
  // Lightweight probe: try to create a message that would trigger mirroring,
  // but DO NOT fail if it doesn't work — just infer capability.

  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const testUrl = `${normalizedBaseUrl}/agent/messages`;

  try {
    const liveEmployeeIds = await resolveEmployeeIdsByKey({
      agentBaseUrl: normalizedBaseUrl,
      employees: [
        {
          key: "infraOpsManager",
          roleId: "infra-ops-manager",
          teamId: "team_infra",
          runtimeStatus: "implemented",
        },
        {
          key: "reliabilityEngineer",
          roleId: "reliability-engineer",
          teamId: "team_validation",
          runtimeStatus: "implemented",
        },
      ],
    });

    const res = await fetch(testUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyId: "company_internal_aep",
        threadId: "capability_probe_thread",
        senderEmployeeId: liveEmployeeIds.infraOpsManager,
        receiverEmployeeId: liveEmployeeIds.reliabilityEngineer,
        type: "coordination",
        source: "internal",
        subject: "adapter capability probe",
        body: "probe",
      }),
    });

    // If the API itself fails, we can't infer anything
    if (!res.ok) {
      return { slackConfigured: false, emailConfigured: false };
    }

    const json = await res.json();

    const deliveries = Array.isArray(json?.mirrorDeliveries)
      ? json.mirrorDeliveries
      : [];

    const slackConfigured = hasDeliveredMirrorOutcome(deliveries, "slack");

    const emailConfigured = hasDeliveredMirrorOutcome(deliveries, "email");

    return { slackConfigured, emailConfigured };
  } catch {
    return { slackConfigured: false, emailConfigured: false };
  }
}

export function warnIfNoAdapters(cap: AdapterCapabilities): void {
  if (!cap.slackConfigured && !cap.emailConfigured) {
    console.warn(
      "Validation warning: no external adapters (Slack/email) appear to be configured in this environment. " +
      "External interaction scenarios will be skipped or degraded.",
    );
  }
}
