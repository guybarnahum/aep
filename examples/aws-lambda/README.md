# AWS Lambda example

Minimal Lambda artifact used by the AEP AWS node deployment adapter for Commit 5.

This example is intentionally tiny. It exists only to validate that:

- deploy returns a real `deployment_ref`
- deploy returns a reachable `preview_url`
- teardown destroys the deployed resource

Provisioning logic lives in:

- `services/deployment-engine/src/providers/aws/node-adapter.ts`
