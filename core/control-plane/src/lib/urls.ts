export function buildTracePath(traceId: string): string {
  return `/trace/${encodeURIComponent(traceId)}`;
}