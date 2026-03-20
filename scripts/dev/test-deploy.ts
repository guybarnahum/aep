import { CloudflarePreviewAdapter } from "../../services/deployment-engine/src/index";

async function main() {
  const adapter = new CloudflarePreviewAdapter();

  const result = await adapter.deployPreview({
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