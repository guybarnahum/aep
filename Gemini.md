# Gemini Context: AEP Project Intelligence
**Last Updated:** April 2026
**Status:** PR1 Verified (Org Identity)

## 🎯 Strategic Context
AEP is an "Infrastructure-as-an-Organization" runtime. Transitions between layers require synchronized updates across both the TypeScript identity definitions and the authoritative D1 relational catalog.

## 🧠 Core Mental Model
* **Substrate:** Cloudflare Workers (Logic), Durable Objects (State Machines), D1 (Authoritative SQL State).
* **Two-Part Org Updates (Critical Lesson):** Org identity changes are NOT code-only. They are atomic two-part changes:
    1. **Code Definition:** TypeScript interfaces, roles, and employee objects.
    2. **Authoritative Migration:** D1 catalog and scope-binding seeds.
* **Governance-First Routing:** Routes like `/agent/employees/:id/scope` do not trust in-memory code; they trust the D1 `employees_catalog` and `employee_scope_bindings`.
* **Zero-Inference:** Prioritize actual D1 state over TypeScript definitions when diagnosing 404s or authority failures.

## 📂 Key Entities & Schema
* **Teams:** `TEAM_INFRA`, `TEAM_VALIDATION`, `TEAM_WEB_PRODUCT`.
* **D1 Auth Tables:** `employees_catalog`, `employee_scope_bindings`, `operator_agent_budgets`.
* **Reliability Engineer:** `emp_val_specialist_01` (Validation Specialist).

## 🛠️ Operational Directives
1. **Atomic PRs:** Whenever a new employee or role is added, the PR MUST include both the `.ts` changes and a corresponding `.sql` migration in `infra/cloudflare/d1/operator-agent-migrations/`.
2. **Post-Mortem Insight:** A 404 on a scope route is the primary indicator of a Code/DB sync gap.
3. **Trace-First:** Every reasoning step must produce evidence for forensic reconstruction.

## 📈 History & Evolution
* **PR1 (Org Identity):** Initial failure due to missing D1 catalog/scope seed. Fixed by `0006_validation_specialist_catalog_seed.sql`.
* **Lesson Learned:** TypeScript is the *capability* definition; D1 is the *authority* record.
* **Current Objective:** Implement **PR2 (The Task & Decision Ledger)** using the atomic update rule.