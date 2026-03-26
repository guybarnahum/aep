/* eslint-disable no-console */

export {};

type EmployeesResponse = {
  ok: true;
  count: number;
  employees: Array<{
    identity: {
      employeeId: string;
      roleId: string;
      employeeName: string;
    };
    authority: Record<string, unknown>;
    budget: Record<string, unknown>;
    effectiveAuthority: Record<string, unknown>;
    effectiveBudget: Record<string, unknown>;
    effectiveState: {
      state: "enabled" | "disabled_pending_review" | "disabled_by_manager" | "restricted";
      blocked: boolean;
    };
  }>;
};

type ManagerLogResponse = {
  ok: true;
  managerEmployeeId: string;
  count: number;
  entries: unknown[];
};

type EmployeeControlsResponse = {
  ok: true;
  count?: number;
  entries?: Array<{
    employeeId: string;
    control: {
      state: "enabled" | "disabled_pending_review" | "disabled_by_manager" | "restricted";
      budgetOverride?: Record<string, unknown>;
      authorityOverride?: Record<string, unknown>;
    } | null;
    effectiveState: {
      state: "enabled" | "disabled_pending_review" | "disabled_by_manager" | "restricted";
      blocked: boolean;
    };
  }>;
  employeeId?: string;
  control?: {
    state: "enabled" | "disabled_pending_review" | "disabled_by_manager" | "restricted";
    budgetOverride?: Record<string, unknown>;
    authorityOverride?: Record<string, unknown>;
  } | null;
  effectiveState?: {
    state: "enabled" | "disabled_pending_review" | "disabled_by_manager" | "restricted";
    blocked: boolean;
  };
};

type WorkLogResponse = {
  ok: true;
  employeeId: string;
  count: number;
  entries: unknown[];
};

type EscalationsResponse = {
  ok: true;
  count: number;
  escalations: unknown[];
};

type ControlHistoryResponse = {
  ok: true;
  count: number;
  entries: unknown[];
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed: ${response.status} ${body}`);
  }
  return (await response.json()) as T;
}

async function main(): Promise<void> {
  const agentBaseUrl = requireEnv("OPERATOR_AGENT_BASE_URL");

  const employees = await readJson<EmployeesResponse>(
    await fetch(`${agentBaseUrl}/agent/employees`)
  );

  if (!employees.ok) {
    throw new Error("/agent/employees did not return ok=true");
  }

  const employeeIds = new Set(employees.employees.map((e) => e.identity.employeeId));

  if (!employeeIds.has("emp_timeout_recovery_01")) {
    throw new Error("Expected /agent/employees to include timeout recovery employee");
  }

  if (!employeeIds.has("emp_retry_supervisor_01")) {
    throw new Error("Expected /agent/employees to include retry supervisor employee");
  }

  if (!employeeIds.has("emp_infra_ops_manager_01")) {
    throw new Error("Expected /agent/employees to include infra ops manager employee");
  }

  if (employees.count < 3) {
    throw new Error(
      `Expected at least 3 employees, got ${employees.count}`
    );
  }

  const managerLog = await readJson<ManagerLogResponse>(
    await fetch(
      `${agentBaseUrl}/agent/manager-log?managerEmployeeId=emp_infra_ops_manager_01&limit=10`
    )
  );

  if (!managerLog.ok) {
    throw new Error("/agent/manager-log did not return ok=true");
  }

  const employeeControls = await readJson<EmployeeControlsResponse>(
    await fetch(`${agentBaseUrl}/agent/employee-controls`)
  );

  if (!employeeControls.ok) {
    throw new Error("/agent/employee-controls did not return ok=true");
  }

  const workLog = await readJson<WorkLogResponse>(
    await fetch(`${agentBaseUrl}/agent/work-log?employeeId=emp_timeout_recovery_01&limit=10`)
  );

  if (!workLog.ok) {
    throw new Error("/agent/work-log did not return ok=true");
  }

  const escalations = await readJson<EscalationsResponse>(
    await fetch(`${agentBaseUrl}/agent/escalations?limit=10`)
  );

  if (!escalations.ok) {
    throw new Error("/agent/escalations did not return ok=true");
  }

  const controlHistory = await readJson<ControlHistoryResponse>(
    await fetch(`${agentBaseUrl}/agent/control-history?limit=10`)
  );

  if (!controlHistory.ok) {
    throw new Error("/agent/control-history did not return ok=true");
  }

  for (const employee of employees.employees) {
    if (!employee.effectiveAuthority) {
      throw new Error(
        `Employee ${employee.identity.employeeId} missing effectiveAuthority`
      );
    }

    if (!employee.effectiveBudget) {
      throw new Error(
        `Employee ${employee.identity.employeeId} missing effectiveBudget`
      );
    }

    if (employee.effectiveState.state === "restricted") {
      if (!employee.effectiveState.blocked && "maxActionsPerScan" in employee.effectiveBudget) {
        const maxActions = (employee.effectiveBudget as Record<string, unknown>)
          .maxActionsPerScan;
        if (typeof maxActions !== "number" || maxActions > (employee.budget as Record<string, unknown>).maxActionsPerScan) {
          throw new Error(
            `Restricted employee ${employee.identity.employeeId} effective budget should be narrower`
          );
        }
      }
    }
  }

  console.log("operator-surface-check passed", {
    employeeCount: employees.count,
    managerLogCount: managerLog.count,
    controlsListed: employeeControls.count ?? 1,
    workLogCount: workLog.count,
    escalationsCount: escalations.count,
    controlHistoryCount: controlHistory.count,
  });
}

main().catch((error) => {
  console.error("operator-surface-check failed");
  console.error(error);
  process.exit(1);
});
