/* eslint-disable no-console */

export {};

type RunEnvelope = {
  ok?: boolean;
  executionContext?: {
    executionSource: string;
    companyId?: string;
    taskId?: string;
    heartbeatId?: string;
  };
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function readJson(response: Response): Promise<unknown> {
  const body = await response.text();
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return { raw: body };
  }
}

async function postRun(
  agentBaseUrl: string,
  body: Record<string, unknown>,
  headers: Record<string, string>
): Promise<{ status: number; json: unknown }> {
  const response = await fetch(`${agentBaseUrl}/agent/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    json: await readJson(response),
  };
}

async function main(): Promise<void> {
  const agentBaseUrl = requireEnv("OPERATOR_AGENT_BASE_URL");

  const validBody = {
    departmentId: "aep-infra-ops",
    employeeId: "emp_infra_ops_manager_01",
    roleId: "infra-ops-manager",
    trigger: "paperclip",
    policyVersion: "commit10-stageD",
    companyId: "company-1",
    taskId: `task-${Date.now()}`,
    heartbeatId: `hb-${Date.now()}`,
    targetEmployeeIdsOverride: [
      "emp_timeout_recovery_01",
      "emp_retry_supervisor_01",
    ],
  };

  const validPaperclip = await postRun(agentBaseUrl, validBody, {
    "x-aep-execution-source": "paperclip",
  });

  if (validPaperclip.status !== 200) {
    throw new Error(
      `Expected valid paperclip request to return 200, got ${validPaperclip.status}`
    );
  }

  const validPayload = validPaperclip.json as RunEnvelope;
  if (validPayload.executionContext?.executionSource !== "paperclip") {
    throw new Error("Expected executionContext.executionSource=paperclip");
  }
  if (validPayload.executionContext?.companyId !== "company-1") {
    throw new Error("Expected executionContext.companyId=company-1");
  }

  const missingMetadata = await postRun(
    agentBaseUrl,
    {
      ...validBody,
      heartbeatId: undefined,
    },
    {
      "x-aep-execution-source": "paperclip",
    }
  );

  if (missingMetadata.status !== 400) {
    throw new Error(
      `Expected missing paperclip metadata to return 400, got ${missingMetadata.status}`
    );
  }

  const missingSource = await postRun(
    agentBaseUrl,
    {
      departmentId: "aep-infra-ops",
      employeeId: "emp_infra_ops_manager_01",
      roleId: "infra-ops-manager",
      trigger: "manual",
      policyVersion: "commit10-stageD",
      targetEmployeeIdsOverride: [
        "emp_timeout_recovery_01",
        "emp_retry_supervisor_01",
      ],
    },
    {}
  );

  if (missingSource.status !== 400) {
    throw new Error(
      `Expected missing execution source to return 400, got ${missingSource.status}`
    );
  }

  const operatorRun = await postRun(
    agentBaseUrl,
    {
      departmentId: "aep-infra-ops",
      employeeId: "emp_infra_ops_manager_01",
      roleId: "infra-ops-manager",
      trigger: "manual",
      policyVersion: "commit10-stageD",
      targetEmployeeIdsOverride: [
        "emp_timeout_recovery_01",
        "emp_retry_supervisor_01",
      ],
    },
    {
      "x-aep-execution-source": "operator",
      "x-actor": "ci-paperclip-first-execution-check",
    }
  );

  if (operatorRun.status !== 200) {
    throw new Error(`Expected operator source to return 200, got ${operatorRun.status}`);
  }

  const operatorPayload = operatorRun.json as RunEnvelope;
  if (operatorPayload.executionContext?.executionSource !== "operator") {
    throw new Error("Expected executionContext.executionSource=operator");
  }

  const schedulerStatusResponse = await fetch(`${agentBaseUrl}/agent/scheduler-status`);
  const schedulerStatus = (await readJson(schedulerStatusResponse)) as {
    primaryScheduler?: string;
    cronFallbackEnabled?: boolean;
  };

  if (schedulerStatusResponse.status !== 200) {
    throw new Error(
      `Expected /agent/scheduler-status to return 200, got ${schedulerStatusResponse.status}`
    );
  }

  if (schedulerStatus.primaryScheduler !== "paperclip") {
    throw new Error(
      `Expected primaryScheduler=paperclip, got ${String(schedulerStatus.primaryScheduler)}`
    );
  }

  const expectAuthRequired = process.env.EXPECT_PAPERCLIP_AUTH_REQUIRED === "true";
  const configuredSecret = process.env.PAPERCLIP_SHARED_SECRET;

  if (expectAuthRequired) {
    const missingSecret = await postRun(agentBaseUrl, validBody, {
      "x-aep-execution-source": "paperclip",
    });

    if (missingSecret.status !== 400) {
      throw new Error(
        `Expected missing paperclip shared secret to return 400 when auth required, got ${missingSecret.status}`
      );
    }

    if (!configuredSecret) {
      throw new Error(
        "EXPECT_PAPERCLIP_AUTH_REQUIRED=true but PAPERCLIP_SHARED_SECRET is not set in CI environment"
      );
    }

    const validSecret = await postRun(agentBaseUrl, validBody, {
      "x-aep-execution-source": "paperclip",
      "x-paperclip-shared-secret": configuredSecret,
    });

    if (validSecret.status !== 200) {
      throw new Error(
        `Expected authenticated paperclip request to return 200, got ${validSecret.status}`
      );
    }
  }

  console.log("paperclip-first-execution-check passed", {
    primaryScheduler: schedulerStatus.primaryScheduler,
    cronFallbackEnabled: schedulerStatus.cronFallbackEnabled,
    paperclipAccepted: validPaperclip.status,
    paperclipMissingMetadataRejected: missingMetadata.status,
    missingSourceRejected: missingSource.status,
    operatorAccepted: operatorRun.status,
    authRequiredTested: expectAuthRequired,
  });
}

main().catch((error) => {
  console.error("paperclip-first-execution-check failed");
  console.error(error);
  process.exit(1);
});
