import * as employeeIds from "./employee-ids";
/* eslint-disable no-console */

export type AdapterCapabilities = {
  slackConfigured: boolean;
  emailConfigured: boolean;
};

export async function detectAdapterCapabilities(baseUrl: string): Promise<AdapterCapabilities> {
  // Lightweight probe: try to create a message that would trigger mirroring,
  // but DO NOT fail if it doesn't work — just infer capability.

  const testUrl = `${baseUrl.replace(/\/$/, "")}/agent/messages`;

  try {
    const res = await fetch(testUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyId: "company_internal_aep",
        threadId: "capability_probe_thread",
        senderEmployeeId: employeeIds.EMPLOYEE_INFRA_OPS_MANAGER_ID,
        receiverEmployeeId: employeeIds.EMPLOYEE_RELIABILITY_ENGINEER_ID,
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

    const slackConfigured = deliveries.some(
      (d: any) => d?.channel === "slack" && d?.status !== "failed",
    );

    const emailConfigured = deliveries.some(
      (d: any) => d?.channel === "email" && d?.status !== "failed",
    );

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
