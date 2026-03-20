# AEP MVP v1

## Objective

Build the smallest trustworthy system that can take a GitHub repo, deploy a Cloudflare preview environment, test it, show a full execution trace, tear it down, and prove cleanup.

## Single workflow

`INIT -> CREATE_ENV -> DEPLOY -> HEALTH_CHECK -> SMOKE_TEST -> TEARDOWN -> CLEANUP_AUDIT -> COMPLETE`

## MVP constraints

- single tenant in practice, tenant-aware schema
- one service type: Cloudflare Worker
- one environment type: ephemeral preview
- one dashboard: minimal operator console
- one test type: health + smoke
- full event tracing and cleanup verification

## Done when

- preview deploy runs end-to-end
- health and smoke tests run
- teardown completes
- cleanup audit passes
- a human can inspect the full run timeline
