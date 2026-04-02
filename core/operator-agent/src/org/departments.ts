import type { DepartmentId } from "@aep/operator-agent/types";

export const departments: Record<DepartmentId, { id: DepartmentId; name: string }> = {
  "aep-infra-ops": {
    id: "aep-infra-ops",
    name: "AEP Infra Operations",
  },
};
