# AEP Dashboard

## What this app is

The AEP Dashboard is the operator-facing UI for AEP.

It currently combines two live views:

- control-plane views:
  - tenants
  - services
- operator-agent views:
  - employees
  - escalations
  - approvals
  - manager log
  - control history
  - roadmaps
  - scheduler status

It is a static Vite app and should be deployed separately from the Workers.

---

## Required environment variables

The dashboard requires two build-time environment variables:

- `VITE_CONTROL_PLANE_BASE_URL`
- `VITE_OPERATOR_AGENT_BASE_URL`

Example local configuration:

```dotenv
VITE_CONTROL_PLANE_BASE_URL=http://127.0.0.1:8788
VITE_OPERATOR_AGENT_BASE_URL=http://127.0.0.1:8797
```

You can create a local `.env` file with:

```bash
cp .env.example .env
```

---

## Local development

```bash
cd apps/dashboard
npm install
npm run dev
```

---

## Build

```bash
cd apps/dashboard
npm install
npm run build
```

The app outputs static assets to:

```text
dist/
```

---

## Cloudflare Pages deployment

Recommended Cloudflare Pages settings:

- **Root directory:** `apps/dashboard`
- **Build command:** `npm run build`
- **Build output directory:** `dist`

Required Pages environment variables:

- `VITE_CONTROL_PLANE_BASE_URL`
- `VITE_OPERATOR_AGENT_BASE_URL`

These values should point to the deployed staging Workers.

Example staging values:

```text
VITE_CONTROL_PLANE_BASE_URL=https://<staging-control-plane>.workers.dev
VITE_OPERATOR_AGENT_BASE_URL=https://<staging-operator-agent>.workers.dev
```

The dashboard calls both services directly from the browser, so those services must allow CORS from the dashboard origin.

---

## Deployment model

The dashboard is intentionally deployed separately from the Worker services.

This keeps:

- UI deployment independent from runtime orchestration
- staging observability simple
- browser-based access direct and transparent

The dashboard does not proxy the APIs. It uses the configured base URLs directly.
