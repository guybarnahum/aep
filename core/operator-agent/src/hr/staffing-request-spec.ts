export type StaffingEmployeeSpecValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateStaffingEmployeeSpec(
  spec: Record<string, unknown> | undefined,
  expected: { roleId: string; teamId: string },
): StaffingEmployeeSpecValidationResult {
  if (!spec) return { ok: true };

  if (spec.roleId !== expected.roleId) {
    return { ok: false, error: "employeeSpec.roleId must match staffing request roleId" };
  }

  if (spec.teamId !== expected.teamId) {
    return { ok: false, error: "employeeSpec.teamId must match staffing request teamId" };
  }

  if (!["implemented", "planned", "disabled"].includes(String(spec.runtimeStatus))) {
    return { ok: false, error: "employeeSpec.runtimeStatus must be implemented, planned, or disabled" };
  }

  if (!["active", "draft", "on_leave", "retired", "terminated", "archived"].includes(String(spec.employmentStatus))) {
    return { ok: false, error: "employeeSpec.employmentStatus is invalid" };
  }

  if (typeof spec.schedulerMode !== "string" || spec.schedulerMode.trim().length === 0) {
    return { ok: false, error: "employeeSpec.schedulerMode is required" };
  }

  return { ok: true };
}
