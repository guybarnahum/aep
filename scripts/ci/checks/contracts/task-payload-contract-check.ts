/* eslint-disable no-console */

import {
  TASK_CONTRACTS,
  TaskPayloadValidationError,
  validateTaskPayloadContract,
} from "../../../../core/operator-agent/src/lib/task-contracts";

function sampleValue(type?: string): unknown {
  if (type === "number") return 1;
  if (type === "boolean") return true;
  if (type === "object") return { ok: true };
  if (type === "array") return ["ok"];
  return "ok";
}

for (const contract of TASK_CONTRACTS) {
  const validPayload: Record<string, unknown> = {};

  for (const field of contract.payloadContract.required) {
    validPayload[field.key] = sampleValue(field.type);
  }

  const resolved = validateTaskPayloadContract({
    taskType: contract.taskType,
    payload: validPayload,
  });

  if (resolved !== contract.taskType) {
    throw new Error(`Expected ${contract.taskType}, got ${resolved}`);
  }

  for (const field of contract.payloadContract.required) {
    const invalidPayload = { ...validPayload };
    delete invalidPayload[field.key];

    try {
      validateTaskPayloadContract({
        taskType: contract.taskType,
        payload: invalidPayload,
      });
      throw new Error(
        `Expected missing field ${field.key} to fail for ${contract.taskType}`,
      );
    } catch (error) {
      if (!(error instanceof TaskPayloadValidationError)) {
        throw error;
      }

      if (error.code !== "missing_required_payload_field") {
        throw new Error(
          `Expected missing_required_payload_field, got ${error.code}`,
        );
      }
    }
  }
}

console.log("task-payload-contract-check passed", {
  contractCount: TASK_CONTRACTS.length,
});
