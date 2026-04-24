import type { EmployeeProjection } from "../contracts/employees";
import type { ApprovalEntry, ApprovalState } from "../contracts/approvals";

type MirrorDeliveryRecord = {
  channel?: unknown;
  status?: unknown;
};

const NON_DELIVERED_MIRROR_STATUSES = new Set(["failed", "skipped"]);

export function hasObservableMirrorOutcome(deliveries: unknown[]): boolean {
  return deliveries.some((delivery) => {
    const status = (delivery as MirrorDeliveryRecord | null | undefined)?.status;
    return status === "delivered" || NON_DELIVERED_MIRROR_STATUSES.has(String(status));
  });
}

export function hasDeliveredMirrorOutcome(
  deliveries: unknown[],
  channel?: string,
): boolean {
  return deliveries.some((delivery) => {
    const entry = delivery as MirrorDeliveryRecord | null | undefined;
    return (
      entry?.status === "delivered" &&
      (typeof channel === "undefined" || entry?.channel === channel)
    );
  });
}

export function hasOnlyNonDeliveredMirrorOutcomes(deliveries: unknown[]): boolean {
  return (
    deliveries.length > 0 &&
    deliveries.every((delivery) => {
      const status = (delivery as MirrorDeliveryRecord | null | undefined)?.status;
      return NON_DELIVERED_MIRROR_STATUSES.has(String(status));
    })
  );
}

export function validateEmployeeProjectionBehavior(
  employee: EmployeeProjection,
): void {
  const runtimeStatus = employee.runtime.runtimeStatus;

  if (runtimeStatus === "planned") {
    if (employee.runtime.effectiveAuthority) {
      throw new Error(
        `Planned employee ${employee.identity.employeeId} should not expose effectiveAuthority in /agent/employees`,
      );
    }

    if (employee.runtime.effectiveBudget) {
      throw new Error(
        `Planned employee ${employee.identity.employeeId} should not expose effectiveBudget in /agent/employees`,
      );
    }

    if (employee.runtime.effectiveState) {
      throw new Error(
        `Planned employee ${employee.identity.employeeId} should not expose effectiveState in /agent/employees`,
      );
    }

    return;
  }

  if (runtimeStatus === "disabled") {
    return;
  }

  if (!employee.runtime.effectiveAuthority) {
    throw new Error(
      `Employee ${employee.identity.employeeId} missing runtime.effectiveAuthority`,
    );
  }

  if (!employee.runtime.effectiveBudget) {
    throw new Error(
      `Employee ${employee.identity.employeeId} missing runtime.effectiveBudget`,
    );
  }

  if (!employee.runtime.effectiveState) {
    throw new Error(
      `Employee ${employee.identity.employeeId} missing runtime.effectiveState`,
    );
  }

  if (employee.runtime.effectiveState.state === "restricted") {
    if (
      !employee.runtime.effectiveState.blocked &&
      "maxActionsPerScan" in employee.runtime.effectiveBudget
    ) {
      const maxActions = (
        employee.runtime.effectiveBudget as Record<string, unknown>
      ).maxActionsPerScan;

      if (typeof maxActions !== "number") {
        throw new Error(
          `Restricted employee ${employee.identity.employeeId} effective budget maxActionsPerScan should be numeric`,
        );
      }
    }
  }
}

export function validateApprovalBehavior(
  approval: ApprovalEntry,
  validApprovalStates: ReadonlySet<ApprovalState | string>,
): void {
  const approvalId = approval.id ?? approval.approvalId;
  const state = approval.state ?? approval.status;

  if (!approvalId) {
    throw new Error("Approval entry missing id/approvalId");
  }

  if (!state || !validApprovalStates.has(state)) {
    throw new Error(`Approval ${approvalId} has invalid state: ${String(state)}`);
  }

  if (state === "approved" && !approval.approvedAt && !approval.decidedAt) {
    throw new Error(
      `Approval ${approvalId} is approved but missing approvedAt/decidedAt timestamp`,
    );
  }

  if (state === "rejected" && !approval.rejectedAt && !approval.decidedAt) {
    throw new Error(
      `Approval ${approvalId} is rejected but missing rejectedAt/decidedAt timestamp`,
    );
  }

  if (state === "expired" && !approval.expiresAt) {
    throw new Error(
      `Approval ${approvalId} is expired but missing expiresAt timestamp`,
    );
  }

  if (
    state === "already_executed" &&
    !approval.consumedAt &&
    !approval.executedAt
  ) {
    throw new Error(
      `Approval ${approvalId} is already_executed but missing consumedAt/executedAt timestamp`,
    );
  }

  if (approval.controlHistory && Array.isArray(approval.controlHistory)) {
    for (const entry of approval.controlHistory) {
      if (!entry.id || !entry.timestamp || !entry.action) {
        throw new Error(
          `Approval ${approvalId} control history entry missing required fields`,
        );
      }
    }
  }
}