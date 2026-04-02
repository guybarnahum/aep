import { WorkerDeploymentAdapter } from "@aep/deployment-engine/worker-adapter";

async function main() {
  const adapter = new WorkerDeploymentAdapter();

  const result = await adapter.deployPreview({
    provider: "cloudflare",
    serviceName: "sample-worker",
    workflowRunId: `local-${Date.now()}`,
  });

  console.log("Deploy result:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Deploy failed:");
  console.error(err);
  process.exit(1);
});