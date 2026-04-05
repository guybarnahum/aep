# Gemini Context: AEP Project Intelligence
**Last Updated:** April 2026
**Status:** PR2 Verified (Task & Decision Ledger)

## 🎯 Strategic Context
AEP has transitioned into a stateful "Work-Order" runtime (Layer 5). The system now distinguishes between where a request originated (Provenance) and how the platform authorizes its execution (Authority).

## 🧠 Core Mental Model
* **Substrate:** Cloudflare Workers (Logic), Durable Objects (State Machines), D1 (Authoritative SQL State).
* **Contract Split (Critical Lesson):** To avoid breaking existing flows, provenance and authority are handled by distinct identifiers:
    1. **workOrderId:** Explicit D1-backed ledger identifier. Used for authoritative task-tracking.
    2. **taskId:** Paperclip-native provenance identifier. Used for cross-system tracking; does NOT require a D1 task row.
* **Atomic Transitions:** A successful run must produce a `Decision` record and update the `Task` status to `completed` in a single batch.
* **Task Lifecycle:** Work orders move strictly through `pending` -> `in-progress` -> `completed` | `failed`.
* **Two-Part Org Updates:** Org identity changes are atomic two-part changes:
    1. **Code Definition:** TypeScript interfaces, roles, and employee objects.
    2. **Authoritative Migration:** D1 catalog and scope-binding seeds.

## 📂 Key Entities & Schema
* **Teams:** `TEAM_INFRA`, `TEAM_VALIDATION`, `TEAM_WEB_PRODUCT`.
* **D1 Auth Tables:** `employees_catalog`, `employee_scope_bindings`, `operator_agent_budgets`.
* **D1 Ledger Tables:** `tasks` (work orders), `decisions` (verdicts).
* **Identifiers:** `workOrderId` (Authority), `taskId` (Provenance).
* **Reliability Engineer:** `emp_val_specialist_01` (Validation Specialist).

## 🛠️ Operational Directives
1. **Contract Integrity:** Never conflate provenance identity with work-order authority. Ledger-backed logic is strictly guarded by the presence of a `workOrderId`.
2. **Atomic PRs:** Whenever a new employee, role, or task type is added, the PR MUST include both the `.ts` changes and a corresponding `.sql` migration in `infra/cloudflare/d1/operator-agent-migrations/`.
3. **Trace-First:** Forensic reconstruction requires linking `Decision` evidence to execution `Traces`. Every reasoning step must produce verifiable evidence.

## 📈 History & Evolution
* **PR1 (Org Identity):** Established the Reliability Engineer. Learned that TypeScript defines capability while D1 defines authority record. Initial failure due to missing D1 catalog/scope seed was fixed by `0006_validation_specialist_catalog_seed.sql`.
* **PR2 (Task Ledger):** Implemented stateful work management. Discovered and fixed a regression where provenance (`taskId`) was incorrectly forced into the authority ledger. Refactored the API to separate tracking from execution authority.
* **Current Objective:** Implement **PR3 (Self-Healing Runtime)**.