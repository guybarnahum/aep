# 🧠 LLM.md — AEP Cognitive Context & Execution Plan

This document is the **source of truth for LLM sessions** working on AEP.

It exists to:
- restore context quickly
- anchor decisions in system reality
- prevent architectural drift
- define the staged execution plan
- enable continuation without re-deriving intent

---

# 1. What AEP Is

AEP (Agentic Engineering Platform) is:

> the **infra + operations kernel of a zero-employee, agentic company**

AEP models:
- agents → employees
- workflows → operations
- control-plane → management
- trace → audit + memory

We are transitioning from:

> “AI as a feature”

to

> “AI as the organization”

---

# 2. Core Architecture (Ground Truth)

## Execution Boundary (CRITICAL)

AEP enforces strict separation:

### Worker runtime (Cloudflare)
- orchestration
- workflow state
- governance
- agent coordination
- trace + audit

### External systems (CI / providers)
- deploy
- teardown
- real-world infra mutation

This must NEVER be violated.

---

## Current System Layers

### 1. Control Plane
- Durable Object orchestration
- D1-backed state
- job + attempt model
- async lifecycle (waiting → running → completed | failed)
- pause / resume

### 2. Operator-Agent Plane
- employee model
- escalations
- approvals
- manager log
- control history
- roadmaps
- scheduler status

### 3. Dashboard / Ops Console
- organization + governance visibility
- execution visibility (partial)

### 4. CI Plane
- deployment validation
- health checks
- operator surface checks
- org shape validation

---

# 3. PR5 → PR6 Transition

PR5 introduced:

> agents as employees

PR6 introduces:

> **organization as first-class runtime structure**

We are no longer modeling a few agents.

We are modeling:
- company
- teams
- employees
- managers
- governance
- coordination

---

# 4. Current State (POST PR6A)

## ✅ PR6A — Completed

### What exists now

#### Organization model
- company
- teams:
  - infra
  - web-product
  - validation

#### Employees (mixed types)
- runtime employees (infra)
- catalog/planned employees (web + validation)

#### Operator-agent surface
- `/agent/employees`
- `/agent/escalations`
- `/agent/approvals`
- `/agent/control-history`
- `/agent/manager-log`
- `/agent/roadmaps`
- `/agent/scheduler-status`

#### Dashboard (department view)
- employees
- escalations
- approvals
- manager log
- control history
- roadmaps
- scheduler

#### CI
- org schema validation
- operator surface checks
- multi-team validation

---

## ⚠️ Critical Reality

Employees now exist in two forms:

### 1. Runtime employees (implemented)
Have:
- effectiveState
- effectiveBudget
- effectiveAuthority

### 2. Catalog / planned employees
Have:
- catalog metadata
- scope
- optional persona

May NOT have:
- effectiveState
- runtime fields

👉 This broke the dashboard and revealed a deeper issue:

> the system lacks a **formal projection contract**

---

# 5. Key Design Insight (Locked)

## 🧍 Employee = Encapsulated Unit

Each employee is:

> a **bounded entity with identity, cognition, and projection**

---

## Split the employee into 3 layers

### 1. Shell (org-visible)
- employeeId
- companyId
- teamId
- roleId
- runtimeStatus
- authority
- budget
- effectiveState

---

### 2. Public Profile (visible)
- displayName
- shortBio
- skills
- avatarUrl

---

### 3. Mind (private, encapsulated)
- base prompt
- tone / decision style
- identity seed
- memory (future)
- internal monologue (future)
- portrait generation prompt
- prompt version

---

## 🔒 Rule

> LLM + generative identity live **inside the employee**

NOT:
- global prompt registry
- shared persona system
- exposed raw cognitive state

System exposes:
- projections
- not internals

---

# 6. Observability-First Principle

Before deeper cognition:

> we must fully observe what already exists

The dashboard and ops-console must mirror:

### Levels of the system

1. Company
2. Teams
3. Employees
4. Governance
5. Execution
6. (future) Cognition

---

## Dashboard vs Ops Console

### Dashboard
- org view
- employees
- governance
- approvals
- escalations
- roadmap

### Ops Console
- runs / jobs / attempts
- trace
- execution debugging

They complement each other.

---

# 7. PR6 Plan

---

## ✅ 6A — Department Surface + Org Seeding (DONE)

- org exists in runtime + UI
- mixed employee types introduced
- dashboard + CI expanded

---

## 🔷 6B — Runtime Projection + Employee Boundary (NEXT)

### 🎯 Goal

Make employees:

> **well-defined, explicit, and bounded**

---

### Introduce canonical projection

```ts
EmployeeProjection = {
  identity: {
    employeeId
    companyId
    teamId
    roleId
  }

  runtime: {
    runtimeStatus: "implemented" | "planned" | "disabled"
    effectiveState?
    effectiveBudget?
    effectiveAuthority?
  }

  publicProfile?: {
    displayName
    bio
    skills
    avatarUrl
  }

  hasCognitiveProfile: boolean
}
```

---

### Requirements

#### 1. Backend must be explicit
- no missing-field inference
- runtimeStatus is REQUIRED

#### 2. UI must not guess
- no assumptions about effectiveState
- no implicit “planned” detection

#### 3. Cognitive layer exists but is hidden
- persona stored
- prompt stored
- NOT exposed by default

#### 4. CI enforces shape
- implemented employees → must have effectiveState
- planned employees → must not fake runtime fields

---

### Definition of Done (6B)

- stable employee API contract
- explicit runtimeStatus
- dashboard uses projection cleanly
- no UI crashes
- CI enforces structure

---

## 🔷 6C — Company Coordination

### Goal
Move from:

> teams exist

to:

> teams interact

---

### Introduce

- company-level orchestration
- cross-team flows
- roadmap → execution linkage

Example:
- Web → Infra → Validation

---

## 🔷 6D — Documentation Lock

- update README.md
- update LLM.md
- lock architecture and plan

Goal:
> no more reconstruction required

---

# 8. Future Phase — Cognition Layer

After observability + projection:

---

## Internal Monologue
- private
- stored in trace / memory
- used for explainability

---

## Inter-Employee Messaging
- explicit communication
- persisted
- visible in org views

---

## LLM Reasoning Loop

Each employee:

1. observes system state
2. reads messages
3. invokes LLM
4. outputs:
   - reasoning
   - internal_monologue
   - decisions
   - messages
5. acts via control-plane APIs

---

# 9. Constraints (DO NOT VIOLATE)

- no infra mutation inside Workers
- no UI as source of truth
- no implicit state inference
- no exposing full cognitive internals by default
- no mixing monologue and messaging
- no unauditable agent actions

---

# 10. Immediate Next Step

👉 Implement **PR6B**

Specifically:

1. define EmployeeProjection
2. update `/agent/employees`
3. normalize catalog + runtime + persona
4. update dashboard to use projection
5. add CI checks

---

# 11. Summary

AEP is now:

> a partially observable agentic organization

The next step is:

> make employees real, bounded, and explicit

Everything after that:
- reasoning
- messaging
- autonomy

depends on this foundation.

# 12. System Levels the UI Must Mirror

The dashboard and ops-console should converge toward reflecting the following levels.

## Level 1: Company
Questions the UI should answer:
- what company is this runtime representing?
- what teams exist?
- what is implemented vs planned?
- what is the active scheduler / governance posture?

## Level 2: Teams / departments
Questions:
- what teams exist?
- what roadmaps and objectives exist per team?
- what employees belong to each team?
- which teams are runtime-active vs catalog-only?

## Level 3: Employees
Questions:
- who are the employees?
- what role do they serve?
- what authority and budget do they have?
- what is their effective state?
- are they blocked, restricted, or planned?
- who manages them?

## Level 4: Governance and supervision
Questions:
- what escalations exist?
- what manager decisions were made?
- what approvals are pending or resolved?
- what control history exists for employees?

## Level 5: Work and execution
Questions:
- what runs, jobs, and attempts exist?
- how do they map to employees and departments?
- what traces and failure kinds are attached?

## Level 6: Cognition and communication (future-facing but planned)
Questions:
- what reasoning led to actions?
- what internal monologue was produced?
- what messages were exchanged between employees?
- what evidence and context drove decisions?

This level is not fully implemented yet, but it is part of the plan and should be represented in the architecture and docs now.