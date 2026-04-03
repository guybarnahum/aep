# AWS Lambda example

Minimal Lambda artifact used by the AEP AWS node deployment adapter.

This example is intentionally tiny. It exists only to validate that:

- deploy returns a real `deployment_ref`
- deploy returns a reachable `preview_url`
- teardown destroys the deployed resource

Current repo state:

- Cloudflare Workers remain the primary control-plane runtime
- this Lambda example is kept as a provider-neutral deployment adapter fixture rather than the main execution path

Provisioning logic lives in:

- `services/deployment-engine/src/providers/aws/node-adapter.ts`
