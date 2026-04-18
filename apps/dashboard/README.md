# AEP Dashboard

## What this app is

The AEP Dashboard is the operator-facing UI for AEP.

It currently combines two live surfaces:

- control-plane views:
  - tenants
  - services
- operator-agent views:
  - employees
  - employee detail
  - roles and job descriptions
  - review cycles
  - employee performance reviews
  - employee employment-event history
  - employee lifecycle actions
  - escalations
  - approvals
  - manager log
  - control history
  - roadmaps
  - scheduler status

The dashboard now includes both read and write people-management flows over canonical operator-agent routes.

Current dashboard people/org routes include:

- `#employees`
- `#employee/:employeeId`
- `#roles`
- `#role/:roleId`
- `#teams`
- `#team/:teamId`
- `#company`

Current dashboard write flows include:

- create employee
- update employee public/profile fields
- apply lifecycle actions such as leave, reassign-team, change-role, retire, terminate, rehire, and archive
- create review cycles
- create employee performance reviews linked to canonical task/artifact/thread evidence

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

Important invariant:

- the dashboard is only a surface over canonical control-plane and operator-agent routes
- employee lifecycle and review mutations must go through those HTTP routes
- the dashboard does not own a parallel people-management state model
