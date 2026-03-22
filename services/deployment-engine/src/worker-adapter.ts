// Temporary compatibility shim for refactoring.
// This file maintains backward compatibility during the multi-provider migration.
// It re-exports the Cloudflare adapter with the legacy NodeWranglerAdapter name
// to avoid breaking existing imports before the refactoring is complete.
// TODO: Remove this file once all internal imports have been migrated to the
// new provider-based structure under ./providers/
export { CloudflareWorkerDeploymentAdapter as WorkerDeploymentAdapter } from "./providers/cloudflare/worker-adapter";
