````
# AEP — Agentic Engineering Platform
### The Infrastructure Department as a Service (IDaaS)

AEP is the runtime kernel for a zero-employee infrastructure company. It models infrastructure operations not as a set of scripts, but as a fully functional operating organization with teams, identities, and authoritative work management.

---

## 👁️ Vision
AEP is designed to be the self-operating infrastructure department inside a larger agentic organization (e.g., a Paperclip-style company). Much like AWS began as Amazon’s internal team, AEP is built to dogfood internally before scaling to external multi-tenant customers.

**The Goal:** A system that plans, codes, deploys, validates, and fixes itself with minimal human intervention.

---

## 🏗️ Architecture: The Five Planes
AEP operates across a Cloudflare-native substrate (Workers, Durable Objects, D1) through five distinct planes:

1.  **Control Plane (The Brain):** Stateful orchestration (Durable Objects), D1-backed runtime state, and provider-neutral job/attempt lifecycles.
2.  **Execution Plane (The Muscle):** Asynchronous execution of infrastructure mutations via operator APIs.
3.  **Observability Plane (The Memory):** A trace-first system where every action is explainable and verifiable via `/trace/:id`.
4.  **Governance Plane (The Trust):** Real-time budget enforcement, cooldowns, and human-in-the-loop approval gates.
5.  **Delivery Plane (The Logistics):** Integration with GitHub Actions and ephemeral "Proving Ground" environments.

---

## 👥 The AEP Organization
The platform is structured into specialized departments composed of autonomous "employees":

| Team | Role | Primary Responsibility |
| :--- | :--- | :--- |
| **Validation Team** | `reliability-engineer` | System integrity, health monitoring, and fix-it loops. |
| **Infra Dev Team** | `infra-ops-manager` | Platform engineering, deployment substrate, and feature dev. |
| **Infra Dev Team** | `timeout-recovery` | Stuck/Timeout job detection and safe intervention. |
| **Infra Dev Team** | `retry-supervisor` | Smart backoff and retry strategy management. |
| **Web Product Team** | `frontend-engineer` | Human interface, AEP dashboard, and documentation. |

### Bounded Autonomous Cron
The department operates under a "Bounded Alternating Cron" model to stay within Cloudflare subrequest limits:
* One infra scanner per tick (alternating between `timeout-recovery` and `retry-supervisor`).
* The `reliability-engineer` runs every tick to ensure continuous safety validation.

---

## ⚖️ The Task & Decision Ledger
AEP 1.0 (Layer 5) introduces a formal stateful work-management model that separates request origin from execution authority:

* **`workOrderId` (Authority):** The explicit D1-backed ledger identifier. Used for authoritative task-tracking, status transitions (`pending` → `in-progress` → `completed`), and recording durable verdicts.
* **`taskId` (Provenance):** The Paperclip-native identifier used for cross-system tracking. It provides history without requiring a local D1 ledger row.
* **Decision Ledger:** A relational record of *why* a choice was made (e.g., `pass`, `remediate`), linked to the authoritative execution trace for forensic reconstruction.

---

## 📍 Current Status — Commit 14.x
AEP has matured into a **Stateful Autonomous Department**.

* **Self-Healing Runtime (PR3):** The **Reliability Engineer** (`emp_val_specialist_01`) autonomously claims `validate-deployment` tasks, executes health checks, and records remediation decisions.
* **Atomic Org Updates:** Organizational identity is synchronized across TypeScript definitions and the authoritative D1 `employees_catalog`.
* **Budget & Cooldown:** Enforced per-scan, per-hour, and per-tenant to ensure safe autonomous behavior.
* **Paperclip-First:** Explicit execution provenance (`x-aep-execution-source`) is required for all runs.

---

## 🚧 Roadmap & Gaps
1.  **CI/CD Bridge (PR4):** Full integration where GitHub Actions wait for agentic verdicts before completing a "Proving Ground" deployment.
2.  **Manager Overlays:** Finalizing the UI for real-time human intervention to clarify intent or freeze agents without code changes.
3.  **Adaptive Policy:** Extending automated "restriction" and "re-enabling" based on cross-worker failure patterns.

---

## 🛠️ Repository Layout
```text
.
├── apps/                 # operator UI surfaces (Dashboard, Ops Console)
├── core/
│   ├── control-plane     # DO-based orchestration engine + inventory APIs
│   └── operator-agent    # autonomous employees + task/decision ledger
├── infra/                # Cloudflare (Wrangler) + D1 migrations
├── scripts/              # CI/CD validation + synthetic failure harnesses
```