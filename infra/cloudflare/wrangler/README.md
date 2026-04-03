# Wrangler configs

Shared Wrangler templates and environment conventions live here.

Current repo state:

- the canonical control-plane config is `core/control-plane/wrangler.jsonc`
- preview deploys render a generated config from `core/control-plane/wrangler.preview.jsonc.template`
- control-plane D1 migrations are sourced from `infra/cloudflare/d1/migrations`
- long-lived environments use Wrangler env sections such as `staging`, `async_validation`, and `production`
