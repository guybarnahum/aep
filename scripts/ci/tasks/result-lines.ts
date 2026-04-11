export function extractTaggedLine(
  output: string,
  prefix: string,
): string | undefined {
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length).trim();
    }
  }
  return undefined;
}

export function extractSkipReason(output: string): string | undefined {
  return extractTaggedLine(output, "[skip] ");
}

export function extractWarnReason(output: string): string | undefined {
  return extractTaggedLine(output, "[warn] ");
}

export function extractDispatchBatchId(output: string): string | undefined {
  return extractTaggedLine(output, "DISPATCH_BATCH_ID=");
}

export function extractTaskId(output: string): string | undefined {
  return extractTaggedLine(output, "TASK_ID=");
}